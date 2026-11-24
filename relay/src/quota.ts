/**
 * Compteur des recherches SerpApi du mois (offre gratuite limitée).
 * Une case par mois du calendrier (heure de Paris), rangée dans Cloudflare KV : `serpapi:2026-11`,
 * plus une case par installation : `serpapi:2026-11:<id>` (le compteur global reste la limite dure).
 * La case s'efface d'elle-même après 40 jours ; le 1er du mois, le compteur repart donc de zéro.
 * Chaque appel à SerpApi (Lens ou Shopping) compte pour 1, réservé AVANT l'appel.
 * KV n'est pas parfaitement exact quand deux recherches partent au même instant : écart d'une
 * recherche au plus, acceptable pour un usage personnel.
 */
import { settings } from './settings';

/** Stockage clé → valeur Cloudflare KV (déclaré dans wrangler.toml). */
export interface Magasin {
  get(cle: string): Promise<string | null>;
  put(cle: string, valeur: string, options?: { expirationTtl?: number }): Promise<void>;
}

export type EtatQuota = { utilise: number; limite: number; mois: string };

/** Mois du calendrier à Paris, au format « 2026-11 ». */
export function moisDe(date: Date): string {
  const parties = new Intl.DateTimeFormat('fr-FR', { timeZone: settings.fuseauQuota, year: 'numeric', month: '2-digit' })
    .formatToParts(date);
  const annee = parties.find((p) => p.type === 'year')?.value ?? '';
  const mois = parties.find((p) => p.type === 'month')?.value ?? '';
  return `${annee}-${mois}`;
}

/** Case du mois : globale, ou propre à une installation. */
export const cleQuota = (mois: string, installation?: string) =>
  installation ? `serpapi:${mois}:${installation}` : `serpapi:${mois}`;

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

const lireNombre = (texte: string | null) => {
  const n = Number(texte);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export class Compteur {
  constructor(
    private readonly magasin: Magasin,
    readonly limite: number,
    private readonly maintenant: () => Date = () => new Date(),
    /** Identifiant d'installation : compteur propre à elle ; absent → compteur global. */
    private readonly installation?: string,
  ) {}

  async etat(): Promise<EtatQuota> {
    const mois = moisDe(this.maintenant());
    return { utilise: lireNombre(await this.magasin.get(cleQuota(mois, this.installation))), limite: this.limite, mois };
  }

  async atteint(): Promise<boolean> {
    const { utilise, limite } = await this.etat();
    return utilise >= limite;
  }

  /** Réserve une recherche : renvoie false (sans rien compter) si le seuil est déjà atteint. */
  async reserver(): Promise<boolean> {
    const { utilise, limite, mois } = await this.etat();
    if (utilise >= limite) return false;
    await this.magasin.put(cleQuota(mois, this.installation), String(utilise + 1), {
      expirationTtl: settings.dureeCaseQuotaS,
    });
    return true;
  }
}

/** Réponse de GET /quota. */
export type EtatQuotaInstallation = {
  installation: { utilise: number; limite: number };
  global: { utilise: number; limite: number };
  mois: string;
};

/**
 * Quota d'une installation : chaque recherche compte à la fois dans sa case et dans la case globale.
 * Refusée si l'une des deux est au seuil (le global reste la limite dure).
 */
export class QuotaInstallation {
  constructor(
    readonly global: Compteur,
    readonly installation: Compteur,
  ) {}

  async etat(): Promise<EtatQuotaInstallation> {
    const [g, i] = await Promise.all([this.global.etat(), this.installation.etat()]);
    return { installation: { utilise: i.utilise, limite: i.limite }, global: { utilise: g.utilise, limite: g.limite }, mois: g.mois };
  }

  async atteint(): Promise<boolean> {
    const [g, i] = await Promise.all([this.global.atteint(), this.installation.atteint()]);
    return g || i;
  }

  async reserver(): Promise<boolean> {
    if (await this.installation.atteint()) return false;
    if (!(await this.global.reserver())) return false;
    return this.installation.reserver();
  }
}
