/**
 * Compteur des recherches SerpApi du mois (offre gratuite limitée).
 * Une case par mois du calendrier (heure de Paris), rangée dans Cloudflare KV : `serpapi:2026-11`.
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

export const cleQuota = (mois: string) => `serpapi:${mois}`;

/** Seuil réglé dans wrangler.toml (texte) ; valeur absente ou illisible → seuil par défaut. */
export function lireLimite(texte: string | undefined): number {
  const n = Number(texte);
  return Number.isInteger(n) && n >= 0 && texte?.trim() !== '' ? n : settings.limiteSerpApiDefaut;
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
  ) {}

  async etat(): Promise<EtatQuota> {
    const mois = moisDe(this.maintenant());
    return { utilise: lireNombre(await this.magasin.get(cleQuota(mois))), limite: this.limite, mois };
  }

  async atteint(): Promise<boolean> {
    const { utilise, limite } = await this.etat();
    return utilise >= limite;
  }

  /** Réserve une recherche : renvoie false (sans rien compter) si le seuil est déjà atteint. */
  async reserver(): Promise<boolean> {
    const { utilise, limite, mois } = await this.etat();
    if (utilise >= limite) return false;
    await this.magasin.put(cleQuota(mois), String(utilise + 1), { expirationTtl: settings.dureeCaseQuotaS });
    return true;
  }
}
