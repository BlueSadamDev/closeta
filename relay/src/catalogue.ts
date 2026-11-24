/**
 * Catalogue partagé et anonyme (Cloudflare D1, docs/SPEC.md, lot 4, étape 2). Seul module qui parle à D1.
 * - `produit` + `observation_prix` : pages produit lues, servies sans relecture pendant 24 h ; une nouvelle
 *   observation seulement quand le prix ou la disponibilité change (historique conservé).
 * - `recherche` : résultats Google Lens et Shopping, réutilisés jusqu'à expiration, sans consommer le quota.
 * Aucune donnée personnelle n'y entre : ni identifiant d'installation, ni jeton, ni adresse IP, ni photo
 * (une photo ne sert de clé que par son empreinte SHA-256).
 * Une panne de D1 ne bloque jamais rien : chaque lecture renvoie alors « rien en cache », chaque écriture est ignorée.
 */
import { dispoDeLaTaille, type Disponibilite, type DispoTaille, type Extraction } from './extract';
import type { Genre } from './genre';
import type { Proposition } from './recherche';
import { settings } from './settings';

/** Ce que le relais utilise de Cloudflare D1 (déclaré dans wrangler.toml, lien `CATALOGUE`). */
export interface BaseD1 {
  prepare(sql: string): InstructionD1;
}
export interface InstructionD1 {
  bind(...valeurs: (string | number | null)[]): InstructionD1;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export type TypeRecherche = keyof typeof settings.dureesRecherche;

/** Empreinte SHA-256 en hexadécimal (texte ou octets). */
export async function empreinte(donnees: string | Uint8Array): Promise<string> {
  const octets = typeof donnees === 'string' ? new TextEncoder().encode(donnees) : donnees;
  const brut = await crypto.subtle.digest('SHA-256', octets as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(brut)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

const estSuivi = (nom: string) => {
  const n = nom.toLowerCase();
  return (settings.parametresSuivi as readonly string[]).includes(n) || settings.prefixesSuivi.some((p) => n.startsWith(p));
};

/**
 * Adresse canonique d'une page : sans les paramètres de suivi connus (utm_*, gclid, fbclid…) ni l'ancre (#…).
 * Les autres paramètres sont gardés (ils peuvent désigner une taille ou une couleur), dans l'ordre alphabétique.
 */
export function adresseCanonique(adresse: string | URL): string {
  const u = new URL(adresse.toString());
  u.hash = '';
  const gardes = [...u.searchParams].filter(([nom]) => !estSuivi(nom)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = new URLSearchParams(gardes).toString();
  return u.toString();
}

/** Requête Shopping comparable : minuscules, espaces simples. */
export const requeteNormalisee = (r: string) => r.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Clé d'une recherche : empreinte de « type | entrée normalisée | genre ».
 * Entrée : adresse canonique de l'image (lens_image), empreinte de la photo (lens_photo), requête (shopping).
 */
export async function cleRecherche(type: TypeRecherche, entree: string, genre: Genre | null | undefined): Promise<string> {
  const normalisee = type === 'shopping' ? requeteNormalisee(entree) : type === 'lens_image' ? adresseCanonique(entree) : entree;
  return empreinte(`${type}|${normalisee}|${genre ?? 'mixte'}`);
}

/** Boutique d'une adresse : son nom de domaine, sans « www. ». */
const boutiqueDe = (url: string) => new URL(url).hostname.replace(/^www\./, '');

const lireJson = <T>(texte: unknown, defaut: T): T => {
  if (typeof texte !== 'string') return defaut;
  try {
    return JSON.parse(texte) as T;
  } catch {
    return defaut;
  }
};

type LigneProduit = {
  id: number;
  nom: string | null;
  marque: string | null;
  image_url: string | null;
  derniere_vue: number;
  prix: number | null;
  devise: string | null;
  disponibilite: Disponibilite | null;
  dispo_tailles: string | null;
};

/** Dernière observation d'un produit, avec la fiche du produit. */
const SQL_PRODUIT = `
  SELECT p.id, p.nom, p.marque, p.image_url, p.derniere_vue, o.prix, o.devise, o.disponibilite, o.dispo_tailles
  FROM produit p
  LEFT JOIN observation_prix o ON o.id = (
    SELECT id FROM observation_prix WHERE produit_id = p.id ORDER BY date DESC, id DESC LIMIT 1
  )
  WHERE p.url = ?`;

export class Catalogue {
  constructor(
    private readonly base: BaseD1,
    private readonly maintenant: () => number = Date.now,
  ) {}

  /**
   * Produit lu il y a moins de 24 h (`url` canonique), dans la forme de /extract (`taille` : celle de la pièce) ;
   * null s'il faut relire la page.
   */
  async produitRecent(url: string, taille: string | null): Promise<Omit<Extraction, 'url'> | null> {
    try {
      const p = await this.base.prepare(SQL_PRODUIT).bind(url).first<LigneProduit>();
      if (!p || p.disponibilite === null || this.maintenant() - p.derniere_vue >= settings.dureePageMs) return null;
      const variantes = lireJson<DispoTaille[]>(p.dispo_tailles, []);
      return {
        nom: p.nom,
        marque: p.marque,
        image: p.image_url,
        prix: p.prix,
        devise: p.devise,
        disponibilite: p.disponibilite,
        dispo_taille: dispoDeLaTaille(Array.isArray(variantes) ? variantes : [], taille),
      };
    } catch {
      return null;
    }
  }

  /**
   * Enregistre une page lue : fiche du produit mise à jour, et nouvelle observation seulement si le prix,
   * la devise ou la disponibilité (globale ou par taille) a changé depuis la dernière.
   * Une page sans nom ni prix n'est pas enregistrée.
   */
  async enregistrerLecture(url: string, e: Extraction, dispoTailles: DispoTaille[]): Promise<void> {
    if (e.nom === null && e.prix === null) return;
    try {
      const date = this.maintenant();
      const ligne = await this.base
        .prepare(
          `INSERT INTO produit (url, boutique, nom, marque, image_url, premiere_vue, derniere_vue)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (url) DO UPDATE SET
             nom = excluded.nom, marque = excluded.marque, image_url = excluded.image_url, derniere_vue = excluded.derniere_vue
           RETURNING id`,
        )
        .bind(url, boutiqueDe(url), e.nom, e.marque, e.image, date, date)
        .first<{ id: number }>();
      if (!ligne) return;
      const derniere = await this.base
        .prepare('SELECT prix, devise, disponibilite, dispo_tailles FROM observation_prix WHERE produit_id = ? ORDER BY date DESC, id DESC LIMIT 1')
        .bind(ligne.id)
        .first<{ prix: number | null; devise: string | null; disponibilite: string; dispo_tailles: string }>();
      const tailles = JSON.stringify(dispoTailles);
      const inchangee =
        derniere !== null &&
        derniere.prix === e.prix &&
        derniere.devise === e.devise &&
        derniere.disponibilite === e.disponibilite &&
        derniere.dispo_tailles === tailles;
      if (inchangee) return;
      await this.base
        .prepare('INSERT INTO observation_prix (produit_id, date, prix, devise, disponibilite, dispo_tailles) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(ligne.id, date, e.prix, e.devise, e.disponibilite, tailles)
        .run();
    } catch {
      // Catalogue indisponible : la réponse part quand même.
    }
  }

  /** Résultats encore valides d'une recherche ; null si absente, expirée ou illisible. */
  async recherche(cle: string): Promise<Proposition[] | null> {
    try {
      const r = await this.base
        .prepare('SELECT resultats FROM recherche WHERE cle = ? AND expire_le > ?')
        .bind(cle, this.maintenant())
        .first<{ resultats: string }>();
      const resultats = r ? lireJson<unknown>(r.resultats, null) : null;
      return Array.isArray(resultats) ? (resultats as Proposition[]) : null;
    } catch {
      return null;
    }
  }

  /** Garde les résultats d'une recherche payée, pour la durée propre à son type. */
  async garderRecherche(cle: string, type: TypeRecherche, resultats: Proposition[]): Promise<void> {
    try {
      const date = this.maintenant();
      await this.base
        .prepare(
          `INSERT INTO recherche (cle, type, resultats, cree_le, expire_le) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (cle) DO UPDATE SET resultats = excluded.resultats, cree_le = excluded.cree_le, expire_le = excluded.expire_le`,
        )
        .bind(cle, type, JSON.stringify(resultats), date, date + settings.dureesRecherche[type])
        .run();
    } catch {
      // Catalogue indisponible : la recherche sera simplement refaite la prochaine fois.
    }
  }

  /** Purge nocturne : supprime les recherches expirées (produits et historique des prix sont conservés). */
  async purger(): Promise<void> {
    await this.base.prepare('DELETE FROM recherche WHERE expire_le <= ?').bind(this.maintenant()).run();
  }
}

/**
 * Recherche SerpApi passée par le catalogue : résultat encore valide → renvoyé tel quel (rien n'est payé) ;
 * sinon `payer()` fait la recherche (réservation du quota comprise) et son résultat est gardé.
 * `payer()` renvoie null en cas d'échec (rien n'est gardé). `suivi` compte les recherches servies et payées.
 */
export async function viaCatalogue(
  catalogue: Catalogue | null | undefined,
  type: TypeRecherche,
  entree: string,
  genre: Genre | null | undefined,
  suivi: SuiviCache,
  payer: () => Promise<Proposition[] | null>,
): Promise<Proposition[] | null> {
  const cle = catalogue ? await cleRecherche(type, entree, genre) : null;
  if (catalogue && cle) {
    const enCache = await catalogue.recherche(cle);
    if (enCache) {
      suivi.servies += 1;
      return enCache;
    }
  }
  const resultats = await payer();
  if (resultats !== null) {
    suivi.payees += 1;
    if (catalogue && cle) await catalogue.garderRecherche(cle, type, resultats);
  }
  return resultats;
}

/** Recherches d'une requête : servies par le catalogue ou payées. `depuis_cache` = aucune payée, au moins une servie. */
export type SuiviCache = { servies: number; payees: number };
export const nouveauSuivi = (): SuiviCache => ({ servies: 0, payees: 0 });
export const depuisCache = (s: SuiviCache) => s.payees === 0 && s.servies > 0;
