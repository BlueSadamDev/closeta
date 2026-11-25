/**
 * Installations de ClosetA (un téléphone = une installation, avec son propre jeton).
 * Rangées dans Cloudflare KV, dans le même espace que le compteur SerpApi :
 * - `jeton:<empreinte SHA-256 du jeton>` → identifiant de l'installation (jamais le jeton en clair) ;
 * - `installation:<id>` → `{ id, nom, cree_le, actif }`.
 * L'ancien jeton partagé RELAY_TOKEN reste accepté : il compte comme l'installation « Principale ».
 * KV met jusqu'à une minute à diffuser un changement : une révocation agit donc en moins d'une minute.
 */
import type { Magasin } from './quota';
import { settings } from './settings';

/** KV avec la liste des clés (page d'administration) et la suppression (révocation). */
export interface MagasinListable extends Magasin {
  delete(cle: string): Promise<void>;
  list(options: { prefix: string; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export type Installation = { id: string; nom: string; cree_le: string | null; actif: boolean };

/** Installation de l'ancien jeton partagé (RELAY_TOKEN). */
export const PRINCIPALE: Installation = { id: 'principale', nom: 'Principale', cree_le: null, actif: true };

const cleJeton = (empreinte: string) => `jeton:${empreinte}`;
const cleInstallation = (id: string) => `installation:${id}`;

const hex = (octets: Uint8Array) => [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');

/** Empreinte SHA-256 d'un texte, en hexadécimal. */
export async function empreinteHex(texte: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte))));
}

/** Compare deux jetons en temps constant (on compare leurs empreintes, de même longueur). */
export async function jetonsEgaux(a: string, b: string): Promise<boolean> {
  const [ea, eb] = await Promise.all([empreinteHex(a), empreinteHex(b)]);
  let difference = 0;
  for (let i = 0; i < ea.length; i++) difference |= ea.charCodeAt(i) ^ eb.charCodeAt(i);
  return difference === 0;
}

/** Identifiant d'installation envoyé par l'app (X-ClosetA-Installation) : un UUID. */
export function identifiantInstallationValide(texte: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(texte);
}

function lireInstallation(texte: string | null): Installation | null {
  if (!texte) return null;
  try {
    const i = JSON.parse(texte) as Partial<Installation>;
    if (typeof i.id !== 'string' || typeof i.nom !== 'string' || typeof i.actif !== 'boolean') return null;
    return { id: i.id, nom: i.nom, cree_le: typeof i.cree_le === 'string' ? i.cree_le : null, actif: i.actif };
  } catch {
    return null;
  }
}

/**
 * Installation correspondant au jeton reçu, ou null si le jeton est inconnu ou révoqué.
 * @param jetonPartage RELAY_TOKEN (installation « Principale »), s'il existe encore.
 */
export async function installationDuJeton(
  jeton: string,
  magasin: Magasin,
  jetonPartage: string | undefined,
): Promise<Installation | null> {
  if (jetonPartage && (await jetonsEgaux(jeton, jetonPartage))) return PRINCIPALE;
  const id = await magasin.get(cleJeton(await empreinteHex(jeton)));
  if (!id) return null;
  const installation = lireInstallation(await magasin.get(cleInstallation(id)));
  return installation?.actif ? installation : null;
}

/** Nom donné à une nouvelle installation : texte non vide, raccourci au besoin. */
export function lireNom(corps: unknown): string | null {
  const nom = typeof corps === 'object' && corps !== null ? (corps as { nom?: unknown }).nom : undefined;
  if (typeof nom !== 'string') return null;
  const propre = nom.trim().slice(0, settings.nomInstallationMax);
  return propre === '' ? null : propre;
}

/** Jeton aléatoire de 32 octets, en base64 adapté aux adresses (sans + / =). */
function nouveauJeton(): string {
  const octets = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Crée une installation ; son jeton n'est renvoyé qu'ici, une seule fois, et seule son empreinte est gardée. */
export async function creerInstallation(
  nom: string,
  magasin: Magasin,
  maintenant: Date = new Date(),
): Promise<{ installation: Installation; jeton: string }> {
  const jeton = nouveauJeton();
  const installation: Installation = { id: crypto.randomUUID(), nom, cree_le: maintenant.toISOString(), actif: true };
  await magasin.put(cleInstallation(installation.id), JSON.stringify(installation));
  await magasin.put(cleJeton(await empreinteHex(jeton)), installation.id);
  return { installation, jeton };
}

/** Noms de toutes les clés KV qui commencent par `prefixe`. */
async function cles(magasin: MagasinListable, prefixe: string): Promise<string[]> {
  const noms: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await magasin.list({ prefix: prefixe, cursor });
    noms.push(...page.keys.map((k) => k.name));
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return noms;
}

/**
 * Efface une installation de KV : sa fiche (nom, dates) et l'empreinte de son jeton (décision de
 * confidentialité du 24 novembre 2026 : rien n'est gardé après la révocation).
 */
async function effacer(id: string, magasin: MagasinListable): Promise<void> {
  for (const nom of await cles(magasin, cleJeton(''))) {
    if ((await magasin.get(nom)) === id) await magasin.delete(nom);
  }
  await magasin.delete(cleInstallation(id));
}

/**
 * Révoque une installation : sa fiche et l'empreinte de son jeton sont effacées (le jeton est refusé
 * en moins d'une minute, délai de diffusion de KV). null si elle n'existe pas (la Principale ne se
 * révoque pas ici). Renvoie l'installation telle qu'elle était, marquée inactive.
 */
export async function revoquerInstallation(id: string, magasin: MagasinListable): Promise<Installation | null> {
  const installation = lireInstallation(await magasin.get(cleInstallation(id)));
  if (!installation) return null;
  await effacer(id, magasin);
  return { ...installation, actif: false };
}

/**
 * Installations actives (sans la Principale), les plus anciennes d'abord. Les installations révoquées
 * avant l'effacement à la révocation (gardées, marquées inactives) sont effacées au passage.
 */
export async function listerInstallations(magasin: MagasinListable): Promise<Installation[]> {
  const installations: Installation[] = [];
  for (const nom of await cles(magasin, cleInstallation(''))) {
    const i = lireInstallation(await magasin.get(nom));
    if (i?.actif) installations.push(i);
    else if (i) await effacer(i.id, magasin);
  }
  return installations.sort((a, b) => (a.cree_le ?? '').localeCompare(b.cree_le ?? ''));
}
