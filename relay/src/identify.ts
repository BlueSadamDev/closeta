/**
 * /identify : retrouver une pièce à partir d'une photo.
 * 1) En même temps : l'IA décrit la photo, et Google Lens cherche des images identiques.
 * 2) Les correspondances Lens en boutique sont les propositions.
 * 3) S'il y en a moins de 3, Google Shopping complète avec des articles proches
 *    (à partir de la recherche écrite par l'IA), étiquetés « alternative ».
 * La photo n'est déposée dans R2 que le temps de la recherche Lens, puis supprimée.
 */
import { type Catalogue, depuisCache, empreinte, nouveauSuivi, viaCatalogue } from './catalogue';
import { filtrerGenre, rechercheAvecGenre, type Genre } from './genre';
import { DESCRIPTION_VIDE, decrirePhoto, type Description, type IA } from './ia';
import { prixDevant, type FournisseurRecherche, type Proposition } from './recherche';
import { classer } from './pertinence';
import { settings } from './settings';

/** Stockage temporaire Cloudflare R2 (déclaré dans wrangler.toml). */
export interface Stockage {
  put(cle: string, valeur: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(cle: string): Promise<{ body: ReadableStream } | null>;
  delete(cle: string): Promise<void>;
}

export type Identification = {
  description: Description;
  resultats: Proposition[];
  /** Vrai quand toutes les recherches viennent du catalogue (aucune recherche payée ni comptée). */
  depuis_cache: boolean;
  incidents?: string[];
};

/** Une photo JPEG commence toujours par les octets FF D8 FF. */
export const estJpeg = (o: Uint8Array) => o.length > 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff;

/** Identifiant de dépôt : 64 caractères hexadécimaux aléatoires, impossibles à deviner. */
export const nouvelIdentifiant = () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
export const identifiantValide = (id: string) => /^[0-9a-f]{64}$/.test(id);
export const clePhoto = (id: string) => `photos/${id}.jpg`;

/** La marque vue par l'IA n'est reportée que si elle figure dans le nom du résultat : jamais devinée. */
export function avecMarque(p: Proposition, marque: string | null): Proposition {
  if (!marque) return p;
  const simplifie = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return simplifie(p.nom).includes(simplifie(marque)) ? { ...p, marque } : p;
}

/**
 * Assemble la liste finale : propositions Lens d'abord (les plus proches de ce que l'IA a vu en tête),
 * alternatives ensuite, au plus 5.
 */
export function assembler(lens: Proposition[], shopping: Proposition[], description: Description): Proposition[] {
  const urls = new Set(lens.map((p) => p.url));
  const alternatives = lens.length >= settings.resultatsMin ? [] : shopping.filter((p) => !urls.has(p.url));
  return [...classer(lens, description), ...classer(alternatives, description)]
    .slice(0, settings.resultatsMax)
    .map((p) => avecMarque(p, description.marque));
}

/** Le seuil mensuel de recherches SerpApi est atteint : aucune recherche n'a été lancée. */
export class QuotaAtteint extends Error {
  constructor() {
    super('quota_atteint');
  }
}

/** Ce que /identify demande au compteur SerpApi : réserver une recherche avant chaque appel. */
export interface Reservation {
  reserver(): Promise<boolean>;
}

export class RechercheIndisponible extends Error {
  constructor(readonly incidents: string[]) {
    super('recherche_indisponible');
  }
}

/** Message d'erreur court et sans secret, pour le diagnostic. */
export const resume = (e: unknown, secret?: string) => {
  const brut = e instanceof Error ? e.message : String(e);
  return (secret ? brut.split(secret).join('***') : brut).slice(0, 160);
};

/**
 * Enchaîne IA, Lens et Shopping. `adressePhoto` est l'adresse publique (temporaire) de la photo.
 * Chaque appel SerpApi est d'abord réservé auprès du compteur : seuil atteint → appel sauté.
 * Lève QuotaAtteint si le seuil a empêché toute recherche, RechercheIndisponible si aucune
 * recherche n'a pu aboutir pour une autre raison (clé absente, réseau).
 */
export async function identifier(
  photo: Uint8Array,
  outils: {
    /** Genre choisi dans les Réglages : appliqué aux seules alternatives (Google Shopping), pas à Lens. */
    genre?: Genre | null;
    ia: IA;
    stockage: Stockage;
    /** Fournisseur de recherche (Lens et Shopping) ; null : aucune recherche payante possible. */
    recherche: FournisseurRecherche | null;
    quota: Reservation;
    adressePhoto: (id: string) => string;
    /** Catalogue partagé : recherches déjà faites, réutilisées sans consommer le quota (absent = sans cache). */
    catalogue?: Catalogue | null;
  },
): Promise<Identification> {
  const { ia, stockage, recherche, quota, catalogue } = outils;
  const genre = outils.genre ?? null;
  const id = nouvelIdentifiant();
  // Étapes en échec, renvoyées seulement en cas de panne (aucun secret dedans).
  const incidents: string[] = [];
  const suivi = nouveauSuivi();

  // La photo ne sert de clé que par son empreinte : elle n'est jamais gardée.
  const lens = async (): Promise<Proposition[] | null> =>
    viaCatalogue(catalogue, 'lens_photo', await empreinte(photo), genre, suivi, lensPayee);

  const lensPayee = async (): Promise<Proposition[] | null> => {
    if (!recherche) {
      incidents.push('cle_serpapi_absente');
      return null;
    }
    if (!(await quota.reserver())) {
      incidents.push('quota_atteint');
      return null;
    }
    try {
      await stockage.put(clePhoto(id), photo, { httpMetadata: { contentType: 'image/jpeg' } });
    } catch (e) {
      incidents.push(`stockage: ${resume(e)}`);
      return null;
    }
    try {
      return await recherche.lens(outils.adressePhoto(id), false);
    } catch (e) {
      incidents.push(`lens: ${resume(e)}`);
      return null;
    } finally {
      // La photo ne sert qu'à Lens : supprimée aussitôt (une règle de R2 nettoie aussi au bout d'un jour).
      await stockage.delete(clePhoto(id)).catch(() => undefined);
    }
  };

  const [description, lensBrut] = await Promise.all([
    decrirePhoto(ia, photo, (e) => incidents.push(`ia: ${resume(e)}`)).catch(() => DESCRIPTION_VIDE),
    lens().catch((e: unknown) => {
      incidents.push(`lens: ${resume(e)}`);
      return null;
    }),
  ]);
  // Gardés dans l'ordre de Lens ; ici, les pièces avec un prix passent devant.
  const trouves = lensBrut === null ? null : prixDevant(lensBrut);

  // Shopping payé : réservation, puis appel ; null = non fait ou en échec.
  const shoppingPaye = async (requete: string): Promise<Proposition[] | null> => {
    if (!recherche) return null;
    if (!(await quota.reserver())) {
      // Seuil atteint après Lens : on garde ce que Lens a trouvé.
      incidents.push('quota_atteint');
      return null;
    }
    try {
      return await recherche.shopping(requete);
    } catch (e) {
      // Shopping en échec : on garde ce que Lens a trouvé.
      incidents.push(`shopping: ${resume(e)}`);
      return null;
    }
  };

  // null = recherche Shopping non faite ou en échec.
  let shopping: Proposition[] | null = null;
  if ((trouves?.length ?? 0) < settings.resultatsMin && (recherche || catalogue) && description.recherche) {
    const requete = rechercheAvecGenre(description.recherche, genre);
    const brut = await viaCatalogue(catalogue, 'shopping', requete, genre, suivi, () => shoppingPaye(requete));
    shopping = brut === null ? null : filtrerGenre(brut, genre);
  } else if (trouves === null && !description.recherche) {
    incidents.push('ia_sans_recherche');
  }

  // Aucune recherche n'a fonctionné : ce n'est pas « rien trouvé », c'est une panne.
  if (trouves === null && shopping === null) {
    throw incidents.includes('quota_atteint') ? new QuotaAtteint() : new RechercheIndisponible(incidents);
  }

  const resultats = assembler(trouves ?? [], shopping ?? [], description);
  // Les étapes en échec (IA trop lente, Shopping en panne…) accompagnent la réponse : utile au diagnostic.
  const reponse = { description, resultats, depuis_cache: depuisCache(suivi) };
  return incidents.length > 0 ? { ...reponse, incidents } : reponse;
}
