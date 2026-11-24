/**
 * Durable Object `Quota` : l'unique compteur des recherches SerpApi (logique dans quota.ts).
 * Cloudflare lui transmet les demandes une par une ; chaque opération sur sa base SQLite est
 * synchrone, donc aucune autre demande ne peut s'intercaler entre la vérification et le comptage.
 * Déclaré dans wrangler.toml (lien QUOTAS, migration new_sqlite_classes).
 */
import { DurableObject } from 'cloudflare:workers';

import type { MagasinListable } from './installations';
import {
  type BaseSql,
  CLE_GLOBALE,
  cleQuota,
  type EtatQuotaInstallation,
  type Limites,
  lireNombre,
  moisDe,
  type ObjetQuota,
  RegistreQuota,
  type Utilises,
} from './quota';

/** État fourni par Cloudflare au Durable Object (ctx), réduit à ce que le compteur utilise. */
export interface EtatObjet {
  storage: { sql: BaseSql };
  blockConcurrencyWhile<T>(action: () => Promise<T>): Promise<T>;
}

/** Ce que le Durable Object lit de l'environnement du Worker : l'espace KV, pour la reprise. */
type EnvQuota = { QUOTA: MagasinListable };

/** Cases KV encore présentes pour ce mois : `global` et une par installation. */
export async function casesKv(kv: MagasinListable, mois: string): Promise<Record<string, number>> {
  const prefixe = cleQuota(mois);
  const noms: string[] = [];
  let curseur: string | undefined;
  do {
    const page = await kv.list({ prefix: prefixe, cursor: curseur });
    noms.push(...page.keys.map((k) => k.name));
    curseur = page.list_complete ? undefined : page.cursor;
  } while (curseur);
  const valeurs: Record<string, number> = {};
  for (const nom of noms) {
    const cle = nom === prefixe ? CLE_GLOBALE : nom.startsWith(`${prefixe}:`) ? nom.slice(prefixe.length + 1) : null;
    if (cle) valeurs[cle] = lireNombre(await kv.get(nom));
  }
  return valeurs;
}

export class Quota extends DurableObject<EnvQuota> implements ObjetQuota {
  private readonly registre: RegistreQuota;

  constructor(
    ctx: EtatObjet,
    env: EnvQuota,
    private readonly maintenant: () => Date = () => new Date(),
  ) {
    super(ctx, env);
    this.registre = new RegistreQuota(ctx.storage.sql);
  }

  /**
   * Mois en cours, après la reprise depuis KV si elle n'a pas encore eu lieu. Pendant la lecture de KV,
   * Cloudflare met les autres demandes en attente (blockConcurrencyWhile).
   */
  private async moisPret(): Promise<string> {
    const mois = moisDe(this.maintenant());
    if (!this.registre.aRepris(mois)) {
      await this.ctx.blockConcurrencyWhile(async () => {
        if (this.registre.aRepris(mois)) return;
        this.registre.reprendre(mois, await casesKv(this.env.QUOTA, mois));
      });
    }
    return mois;
  }

  async reserver(installation: string, limites: Limites): Promise<boolean> {
    const mois = await this.moisPret();
    return this.registre.reserver(mois, installation, limites);
  }

  async etat(installation: string, limites: Limites): Promise<EtatQuotaInstallation> {
    const mois = await this.moisPret();
    return this.registre.etat(mois, installation, limites);
  }

  async utilises(installations: string[]): Promise<Utilises> {
    const mois = await this.moisPret();
    return this.registre.utilises(mois, installations);
  }
}
