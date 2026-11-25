/**
 * Compteur des recherches SerpApi du mois (offre gratuite limitée).
 * Rangé dans un Durable Object `Quota` (voir quotaObjet.ts) : un exemplaire unique, qui traite les
 * demandes une par une, avec sa base SQLite. Table `compteur (mois, cle, utilise)`, où `cle` vaut
 * `global` ou l'identifiant de l'installation (le compteur global reste la limite dure).
 * Chaque appel à SerpApi (Lens ou Shopping) compte pour 1, réservé AVANT l'appel : vérification des
 * deux seuils et comptage des deux cases en une seule opération, donc exact même quand deux
 * téléphones cherchent au même instant.
 * Reprise : au premier appel d'un mois, les cases que KV avait encore pour ce mois (`serpapi:2026-11`,
 * `serpapi:2026-11:<id>`) sont recopiées une fois ; ensuite KV ne sert plus au quota.
 */
import type { ObjetInvitations } from './invitations';
import { settings } from './settings';

/** Stockage clé → valeur Cloudflare KV (déclaré dans wrangler.toml). */
export interface Magasin {
  get(cle: string): Promise<string | null>;
  put(cle: string, valeur: string, options?: { expirationTtl?: number }): Promise<void>;
}

/** Mois du calendrier à Paris, au format « 2026-11 ». */
export function moisDe(date: Date): string {
  const parties = new Intl.DateTimeFormat('fr-FR', { timeZone: settings.fuseauQuota, year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  const annee = parties.find((p) => p.type === 'year')?.value ?? '';
  const mois = parties.find((p) => p.type === 'month')?.value ?? '';
  return `${annee}-${mois}`;
}

/** Mois situé `n` mois avant `mois` (« 2026-01 », 2 → « 2025-11 »). */
export function moisAvant(mois: string, n: number): string {
  const [annee, m] = mois.split('-').map(Number);
  const total = annee * 12 + (m - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Ancienne case KV du mois : globale, ou propre à une installation (lue seulement pour la reprise). */
export const cleQuota = (mois: string, installation?: string) =>
  installation ? `serpapi:${mois}:${installation}` : `serpapi:${mois}`;

/** Clé de la case globale dans la table `compteur`. */
export const CLE_GLOBALE = 'global';

/** Seuil réglé dans wrangler.toml (texte) ; valeur absente ou illisible → seuil par défaut. */
export function lireLimite(texte: string | undefined): number {
  const n = Number(texte);
  return Number.isInteger(n) && n >= 0 && texte?.trim() !== '' ? n : settings.limiteSerpApiDefaut;
}

/** Seuil par installation (SERPAPI_LIMITE_INSTALLATION) ; absent ou illisible → même seuil que le global. */
export function lireLimiteInstallation(texte: string | undefined, global: number): number {
  const n = Number(texte);
  return Number.isInteger(n) && n >= 0 && texte !== undefined && texte.trim() !== '' ? n : global;
}

/** Nombre lu dans une ancienne case KV : illisible ou négatif → 0. */
export const lireNombre = (texte: string | null) => {
  const n = Number(texte);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** Seuils du mois : global et propre à l'installation. */
export type Limites = { global: number; installation: number };

/** Réponse de GET /quota. */
export type EtatQuotaInstallation = {
  installation: { utilise: number; limite: number };
  global: { utilise: number; limite: number };
  mois: string;
};

/** Recherches du mois par installation (page d'administration). */
export type Utilises = { mois: string; utilises: Record<string, number> };

/** Ce que le Worker demande au Durable Object `Quota` (appels à distance, d'où les promesses). */
export interface ObjetQuota {
  reserver(installation: string, limites: Limites): Promise<boolean>;
  etat(installation: string, limites: Limites): Promise<EtatQuotaInstallation>;
  utilises(installations: string[]): Promise<Utilises>;
}

/** Accès au Durable Object, déclaré dans wrangler.toml (lien QUOTAS) : compteur et invitations. */
export interface EspaceQuota {
  idFromName(nom: string): unknown;
  get(id: unknown): ObjetQuota & ObjetInvitations;
}

/** L'unique exemplaire du compteur : toutes les installations passent par lui. */
export const objetQuota = (espace: EspaceQuota) => espace.get(espace.idFromName(settings.nomObjetQuota));

/** Base SQLite d'un Durable Object (ctx.storage.sql), réduite à ce dont le compteur a besoin. */
export interface BaseSql {
  exec(requete: string, ...valeurs: (string | number)[]): { toArray(): Record<string, unknown>[] };
}

/**
 * Logique du compteur, sur la base SQLite du Durable Object. Toutes les opérations sont synchrones :
 * rien ne peut s'intercaler entre la vérification des seuils et le comptage.
 */
export class RegistreQuota {
  constructor(private readonly sql: BaseSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS compteur (
      mois TEXT NOT NULL, cle TEXT NOT NULL, utilise INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (mois, cle))`);
    sql.exec('CREATE TABLE IF NOT EXISTS reprise (mois TEXT PRIMARY KEY)');
  }

  private lire(mois: string, cle: string): number {
    const ligne = this.sql.exec('SELECT utilise FROM compteur WHERE mois = ? AND cle = ?', mois, cle).toArray()[0];
    return typeof ligne?.utilise === 'number' ? ligne.utilise : 0;
  }

  private ajouter(mois: string, cle: string, n: number) {
    this.sql.exec(
      `INSERT INTO compteur (mois, cle, utilise) VALUES (?, ?, ?)
       ON CONFLICT (mois, cle) DO UPDATE SET utilise = utilise + excluded.utilise`,
      mois, cle, n,
    );
  }

  /** La reprise depuis KV a-t-elle déjà eu lieu pour ce mois ? */
  aRepris(mois: string): boolean {
    return this.sql.exec('SELECT mois FROM reprise WHERE mois = ?', mois).toArray().length > 0;
  }

  /**
   * Reprise des cases KV du mois (une seule fois) : chaque valeur est ajoutée au compteur, qui ne
   * peut donc jamais redescendre. Les mois trop anciens sont effacés au passage.
   */
  reprendre(mois: string, valeurs: Record<string, number>) {
    if (this.aRepris(mois)) return;
    for (const [cle, n] of Object.entries(valeurs)) if (n > 0) this.ajouter(mois, cle, n);
    this.sql.exec('INSERT INTO reprise (mois) VALUES (?)', mois);
    const plusAncien = moisAvant(mois, settings.moisQuotaGardes - 1);
    this.sql.exec('DELETE FROM compteur WHERE mois < ?', plusAncien);
    this.sql.exec('DELETE FROM reprise WHERE mois < ?', plusAncien);
  }

  /** Réserve une recherche : false (sans rien compter) si l'un des deux seuils est atteint. */
  reserver(mois: string, installation: string, limites: Limites): boolean {
    if (this.lire(mois, CLE_GLOBALE) >= limites.global) return false;
    if (this.lire(mois, installation) >= limites.installation) return false;
    this.ajouter(mois, CLE_GLOBALE, 1);
    this.ajouter(mois, installation, 1);
    return true;
  }

  etat(mois: string, installation: string, limites: Limites): EtatQuotaInstallation {
    return {
      installation: { utilise: this.lire(mois, installation), limite: limites.installation },
      global: { utilise: this.lire(mois, CLE_GLOBALE), limite: limites.global },
      mois,
    };
  }

  utilises(mois: string, installations: string[]): Utilises {
    return { mois, utilises: Object.fromEntries(installations.map((id) => [id, this.lire(mois, id)])) };
  }
}

/**
 * Quota d'une installation, vu du Worker : chaque recherche compte à la fois dans sa case et dans la
 * case globale, refusée si l'une des deux est au seuil.
 */
export class QuotaInstallation {
  constructor(
    private readonly objet: ObjetQuota,
    private readonly installation: string,
    private readonly limites: Limites,
  ) {}

  etat(): Promise<EtatQuotaInstallation> {
    return this.objet.etat(this.installation, this.limites);
  }

  async atteint(): Promise<boolean> {
    const { installation, global } = await this.etat();
    return global.utilise >= global.limite || installation.utilise >= installation.limite;
  }

  reserver(): Promise<boolean> {
    return this.objet.reserver(this.installation, this.limites);
  }
}
