/**
 * Sauvegarde et restauration : un fichier unique `closeta-AAAA-MM-JJ.closeta`
 * (docs/SPEC.md, « Lot 3 », « Étape 11 »).
 *
 * Contenu (JSON) : format, version du schéma, date, pièces, relevés de prix, photos encodées (base64).
 * Jamais de jeton, de jeton d'administration, d'adresse de relais ni d'identifiant d'installation :
 * chaque pièce et chaque relevé sont recopiés champ par champ, d'après une liste fixe.
 *
 * Lecture : tout le fichier est vérifié avant le moindre changement sur le téléphone.
 */
import type { Article, Disponibilite, Origine, Priorite, Statut, TypeArticle } from './article';
import { estNomSeul, nomDuFichier } from './cheminPhoto';
import type { RelevePrix, SourceReleve } from './releve';
import { settings } from './settings';

export const FORMAT_SAUVEGARDE = 'closeta';
/** Version du schéma de la base au moment de l'écriture (= numéro de la dernière migration). */
export const VERSION_SAUVEGARDE = 4;
/** Plus ancienne version de sauvegarde jamais écrite (lot 3, étape 11). */
const VERSION_SAUVEGARDE_MIN = 3;

export type Sauvegarde = {
  format: typeof FORMAT_SAUVEGARDE;
  version: number;
  /** Date de la sauvegarde, au format ISO. */
  date: string;
  /** Pièces ; `imageLocale` y est un nom de fichier, présent dans `photos`, ou null. */
  articles: Article[];
  releves: RelevePrix[];
  /** Nom du fichier → photo encodée en base64. */
  photos: Record<string, string>;
};

export type Resume = { pieces: number; photos: number };

export type Lecture =
  | { ok: true; sauvegarde: Sauvegarde; resume: Resume }
  | { ok: false; raison: 'illisible' | 'version_recente' };

/** Nom du fichier : closeta-AAAA-MM-JJ.closeta (date du téléphone). */
export function nomDeSauvegarde(maintenant: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  const jour = `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
  return `${settings.sauvegarde.prefixe}${jour}${settings.sauvegarde.extension}`;
}

/** Nom de photo sans danger : pas de dossier, pas de « .. », caractères simples. */
const NOM_SUR = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const nomDePhotoSur = (nom: string) => NOM_SUR.test(nom) && estNomSeul(nom) && !nom.includes('..');

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

// --- Copie champ par champ (aucun autre champ ne peut entrer dans le fichier) ---

const copieArticle = (a: Article, imageLocale: string | null): Article => ({
  id: a.id,
  nom: a.nom,
  marque: a.marque,
  type: a.type,
  categorie: a.categorie,
  taille: a.taille,
  couleur: a.couleur,
  prix: a.prix,
  devise: a.devise,
  urlBoutique: a.urlBoutique,
  imageLocale,
  imageSource: a.imageSource,
  priorite: a.priorite,
  notes: a.notes,
  statut: a.statut,
  origine: a.origine,
  estAlternative: a.estAlternative,
  dateAjout: a.dateAjout,
  dateAchat: a.dateAchat,
  dateMaj: a.dateMaj,
  prixAjout: a.prixAjout,
  disponibilite: a.disponibilite,
  dispoTaille: a.dispoTaille,
  dateVerif: a.dateVerif,
  alternativeDe: a.alternativeDe,
  prixMinObserve: a.prixMinObserve,
  datePrixMinObserve: a.datePrixMinObserve,
});

const copieReleve = (r: RelevePrix): RelevePrix => ({
  id: r.id,
  articleId: r.articleId,
  date: r.date,
  prix: r.prix,
  devise: r.devise,
  disponibilite: r.disponibilite,
  dispoTaille: r.dispoTaille,
  source: r.source,
});

/**
 * Prépare la sauvegarde. `photos` : nom du fichier → contenu en base64, pour les photos lues sur le téléphone.
 * Une pièce dont la photo n'a pas pu être lue est sauvegardée sans photo locale (elle garde son image d'origine).
 */
export function construireSauvegarde(entree: {
  articles: readonly Article[];
  releves: readonly RelevePrix[];
  photos: Readonly<Record<string, string>>;
  maintenant: Date;
}): Sauvegarde {
  const photos: Record<string, string> = {};
  const articles = entree.articles.map((a) => {
    const nom = a.imageLocale ? nomDuFichier(a.imageLocale) : null;
    const contenu = nom && nomDePhotoSur(nom) ? entree.photos[nom] : undefined;
    if (!nom || !contenu) return copieArticle(a, null);
    photos[nom] = contenu;
    return copieArticle(a, nom);
  });
  return {
    format: FORMAT_SAUVEGARDE,
    version: VERSION_SAUVEGARDE,
    date: entree.maintenant.toISOString(),
    articles,
    // Un relevé sans sa pièce rendrait le fichier illisible à la restauration : il est écarté.
    releves: entree.releves.filter((r) => articles.some((a) => a.id === r.articleId)).map(copieReleve),
    photos,
  };
}

export const ecrireSauvegarde = (s: Sauvegarde): string => JSON.stringify(s);

export const resumeDe = (s: Sauvegarde): Resume => ({
  pieces: s.articles.length,
  photos: s.articles.filter((a) => a.imageLocale !== null).length,
});

// --- Lecture et vérification ---

class Illisible extends Error {}

const objet = (v: unknown): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Illisible();
  return v as Record<string, unknown>;
};
const texte = (v: unknown): string => {
  if (typeof v !== 'string' || v.trim() === '') throw new Illisible();
  return v;
};
const texteOuNul = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new Illisible();
  return v;
};
const date = (v: unknown): string => {
  const t = texte(v);
  if (Number.isNaN(Date.parse(t))) throw new Illisible();
  return t;
};
const dateOuNulle = (v: unknown): string | null => (v === null || v === undefined ? null : date(v));
const prix = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new Illisible();
  return v;
};
const parmi = <T extends string>(liste: readonly T[]) => (v: unknown): T => {
  if (typeof v !== 'string' || !(liste as readonly string[]).includes(v)) throw new Illisible();
  return v as T;
};
const booleen = (v: unknown): boolean => {
  if (typeof v !== 'boolean') throw new Illisible();
  return v;
};

const typeArticle = parmi<TypeArticle>(['vetement', 'chaussures']);
const priorite = parmi<Priorite>(['forte', 'moyenne', 'un_jour']);
const statut = parmi<Statut>(['souhaite', 'achete', 'abandonne']);
const origine = parmi<Origine>(['manuel', 'lien', 'photo']);
const disponibilite = parmi<Disponibilite>(['en_stock', 'epuise', 'inconnue']);
const source = parmi<SourceReleve>(['ajout', 'relais', 'manuel']);

function lireArticle(v: unknown, photos: Record<string, string>): Article {
  const a = objet(v);
  const image = texteOuNul(a.imageLocale);
  if (image !== null && (!nomDePhotoSur(image) || photos[image] === undefined)) throw new Illisible();
  return {
    id: texte(a.id),
    nom: texte(a.nom),
    marque: texteOuNul(a.marque),
    type: typeArticle(a.type),
    categorie: texteOuNul(a.categorie),
    taille: texteOuNul(a.taille),
    couleur: texteOuNul(a.couleur),
    prix: prix(a.prix),
    devise: texteOuNul(a.devise),
    urlBoutique: texteOuNul(a.urlBoutique),
    imageLocale: image,
    imageSource: texteOuNul(a.imageSource),
    priorite: priorite(a.priorite),
    notes: texteOuNul(a.notes),
    statut: statut(a.statut),
    origine: origine(a.origine),
    estAlternative: booleen(a.estAlternative),
    dateAjout: date(a.dateAjout),
    dateAchat: dateOuNulle(a.dateAchat),
    dateMaj: date(a.dateMaj),
    prixAjout: prix(a.prixAjout),
    disponibilite: disponibilite(a.disponibilite),
    dispoTaille: disponibilite(a.dispoTaille),
    dateVerif: dateOuNulle(a.dateVerif),
    alternativeDe: texteOuNul(a.alternativeDe),
    // Absents des sauvegardes d'avant le lot 4, étape 3 : null (relu à la prochaine actualisation).
    prixMinObserve: prix(a.prixMinObserve),
    datePrixMinObserve: dateOuNulle(a.datePrixMinObserve),
  };
}

function lireReleve(v: unknown, pieces: Set<string>): RelevePrix {
  const r = objet(v);
  const articleId = texte(r.articleId);
  if (!pieces.has(articleId)) throw new Illisible();
  return {
    id: texte(r.id),
    articleId,
    date: date(r.date),
    prix: prix(r.prix),
    devise: texteOuNul(r.devise),
    disponibilite: disponibilite(r.disponibilite),
    dispoTaille: disponibilite(r.dispoTaille),
    source: source(r.source),
  };
}

const sansDoublon = (ids: string[]) => {
  if (new Set(ids).size !== ids.length) throw new Illisible();
};

/**
 * Lit et vérifie un fichier de sauvegarde. Refuse un fichier abîmé, étranger, ou écrit par une version
 * plus récente de l'app (schéma inconnu ici). Seules les photos utilisées par une pièce sont gardées.
 */
export function lireSauvegarde(contenu: string): Lecture {
  let brut: unknown;
  try {
    brut = JSON.parse(contenu);
  } catch {
    return { ok: false, raison: 'illisible' };
  }
  try {
    const s = objet(brut);
    if (s.format !== FORMAT_SAUVEGARDE) throw new Illisible();
    if (typeof s.version !== 'number' || !Number.isInteger(s.version) || s.version < 1) throw new Illisible();
    if (s.version > VERSION_SAUVEGARDE) return { ok: false, raison: 'version_recente' };
    // Les versions 3 et 4 ont été écrites ; une version 3 n'a pas le prix le plus bas observé (relu ensuite).
    if (s.version < VERSION_SAUVEGARDE_MIN) throw new Illisible();

    const photosBrutes = objet(s.photos);
    if (!Array.isArray(s.articles) || !Array.isArray(s.releves)) throw new Illisible();
    const toutes: Record<string, string> = {};
    for (const [nom, valeur] of Object.entries(photosBrutes)) {
      if (!nomDePhotoSur(nom) || typeof valeur !== 'string' || !BASE64.test(valeur)) throw new Illisible();
      toutes[nom] = valeur;
    }

    const articles = s.articles.map((a) => lireArticle(a, toutes));
    sansDoublon(articles.map((a) => a.id));
    const pieces = new Set(articles.map((a) => a.id));
    const releves = s.releves.map((r) => lireReleve(r, pieces));
    sansDoublon(releves.map((r) => r.id));
    const images = articles.flatMap((a) => (a.imageLocale ? [a.imageLocale] : []));

    const photos: Record<string, string> = {};
    for (const nom of images) photos[nom] = toutes[nom];

    const sauvegarde: Sauvegarde = {
      format: FORMAT_SAUVEGARDE,
      version: s.version,
      date: date(s.date),
      articles,
      releves,
      photos,
    };
    return { ok: true, sauvegarde, resume: resumeDe(sauvegarde) };
  } catch (e) {
    if (e instanceof Illisible) return { ok: false, raison: 'illisible' };
    throw e;
  }
}
