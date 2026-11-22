/**
 * /identify : retrouver une pièce à partir d'une photo.
 * 1) En même temps : l'IA décrit la photo, et Google Lens cherche des images identiques.
 * 2) Les correspondances Lens en boutique sont les propositions.
 * 3) S'il y en a moins de 3, Google Shopping complète avec des articles proches
 *    (à partir de la recherche écrite par l'IA), étiquetés « alternative ».
 * La photo n'est déposée dans R2 que le temps de la recherche Lens, puis supprimée.
 */
import { DESCRIPTION_VIDE, decrirePhoto, type Description, type IA } from './ia';
import { adresseLens, adresseShopping, appelerSerpApi, lireLens, lireShopping, type Proposition } from './recherche';
import { classer } from './pertinence';
import { settings } from './settings';

/** Stockage temporaire Cloudflare R2 (déclaré dans wrangler.toml). */
export interface Stockage {
  put(cle: string, valeur: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(cle: string): Promise<{ body: ReadableStream } | null>;
  delete(cle: string): Promise<void>;
}

export type Identification = { description: Description; resultats: Proposition[]; incidents?: string[] };

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

export class RechercheIndisponible extends Error {
  constructor(readonly incidents: string[]) {
    super('recherche_indisponible');
  }
}

/** Message d'erreur court et sans secret, pour le diagnostic. */
const resume = (e: unknown, secret: string | undefined) => {
  const brut = e instanceof Error ? e.message : String(e);
  return (secret ? brut.split(secret).join('***') : brut).slice(0, 160);
};

/**
 * Enchaîne IA, Lens et Shopping. `adressePhoto` est l'adresse publique (temporaire) de la photo.
 * Lève RechercheIndisponible si aucune recherche n'a pu aboutir (clé absente, quota, réseau).
 */
export async function identifier(
  photo: Uint8Array,
  outils: { ia: IA; stockage: Stockage; cleSerpApi: string | undefined; adressePhoto: (id: string) => string },
): Promise<Identification> {
  const { ia, stockage, cleSerpApi } = outils;
  const id = nouvelIdentifiant();
  // Étapes en échec, renvoyées seulement en cas de panne (aucun secret dedans).
  const incidents: string[] = [];

  const lens = async (): Promise<Proposition[] | null> => {
    if (!cleSerpApi) {
      incidents.push('cle_serpapi_absente');
      return null;
    }
    try {
      await stockage.put(clePhoto(id), photo, { httpMetadata: { contentType: 'image/jpeg' } });
    } catch (e) {
      incidents.push(`stockage: ${resume(e, cleSerpApi)}`);
      return null;
    }
    try {
      return lireLens(await appelerSerpApi(adresseLens(cleSerpApi, outils.adressePhoto(id)), settings.delaiLensMs));
    } catch (e) {
      incidents.push(`lens: ${resume(e, cleSerpApi)}`);
      return null;
    } finally {
      // La photo ne sert qu'à Lens : supprimée aussitôt (une règle de R2 nettoie aussi au bout d'un jour).
      await stockage.delete(clePhoto(id)).catch(() => undefined);
    }
  };

  const [description, trouves] = await Promise.all([
    decrirePhoto(ia, photo, (e) => incidents.push(`ia: ${resume(e, cleSerpApi)}`)).catch(() => DESCRIPTION_VIDE),
    lens().catch((e: unknown) => {
      incidents.push(`lens: ${resume(e, cleSerpApi)}`);
      return null;
    }),
  ]);

  // null = recherche Shopping non faite ou en échec.
  let shopping: Proposition[] | null = null;
  if ((trouves?.length ?? 0) < settings.resultatsMin && cleSerpApi && description.recherche) {
    try {
      shopping = lireShopping(await appelerSerpApi(adresseShopping(cleSerpApi, description.recherche), settings.delaiShoppingMs));
    } catch (e) {
      // Shopping en échec : on garde ce que Lens a trouvé.
      incidents.push(`shopping: ${resume(e, cleSerpApi)}`);
    }
  } else if (trouves === null && !description.recherche) {
    incidents.push('ia_sans_recherche');
  }

  // Aucune recherche n'a fonctionné : ce n'est pas « rien trouvé », c'est une panne.
  if (trouves === null && shopping === null) throw new RechercheIndisponible(incidents);

  const resultats = assembler(trouves ?? [], shopping ?? [], description);
  // Les étapes en échec (IA trop lente, Shopping en panne…) accompagnent la réponse : utile au diagnostic.
  return incidents.length > 0 ? { description, resultats, incidents } : { description, resultats };
}
