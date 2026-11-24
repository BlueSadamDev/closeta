/**
 * Photos des pièces : la base ne garde que le nom du fichier, le dossier est recalculé à l'exécution
 * (docs/SPEC.md, « Lot 3 », « Étape 11 »). Ainsi une sauvegarde se restaure sur un autre téléphone,
 * ou entre l'APK de développement et celui de production, dont les dossiers diffèrent.
 *
 * Dans l'app, une pièce porte toujours le chemin complet (`imageLocale`) ; seule la base change de forme.
 */

let dossierPhotos: string | null = null;

const avecBarre = (uri: string) => (uri.endsWith('/') ? uri : `${uri}/`);

/** Indique le dossier des photos de ce téléphone (appelé une fois, au démarrage, avant toute lecture). */
export function definirDossierPhotos(uri: string | null): void {
  dossierPhotos = uri ? avecBarre(uri) : null;
}

/** Un nom de fichier seul : ni dossier, ni adresse. */
export const estNomSeul = (valeur: string) => !valeur.includes('/') && !valeur.includes(':');

/** La partie après le dernier « / ». */
export const nomDuFichier = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);

/**
 * Valeur à ranger dans la base : le nom seul pour une photo du dossier de l'app.
 * Toute autre valeur est gardée entière (rien n'est perdu).
 */
export function versNomDePhoto(valeur: string | null, dossier: string | null = dossierPhotos): string | null {
  if (!valeur || !dossier) return valeur;
  const d = avecBarre(dossier);
  if (!valeur.startsWith(d)) return valeur;
  const nom = valeur.slice(d.length);
  return nom && estNomSeul(nom) ? nom : valeur;
}

/**
 * Chemin complet à partir de la valeur de la base : un nom seul est rangé dans le dossier de l'app ;
 * un chemin complet (ancienne forme, ou dossier inconnu) est gardé tel quel.
 */
export function versCheminDePhoto(valeur: string | null, dossier: string | null = dossierPhotos): string | null {
  if (!valeur || !dossier || !estNomSeul(valeur)) return valeur;
  return `${avecBarre(dossier)}${valeur}`;
}
