/**
 * Durable Object `Quota` : l'unique compteur des recherches SerpApi (logique dans quota.ts), qui range
 * aussi les codes d'invitation (logique dans invitations.ts) pour garantir leur usage unique.
 * Cloudflare lui transmet les demandes une par une ; chaque opération sur sa base SQLite est
 * synchrone, donc aucune autre demande ne peut s'intercaler entre la vérification et le comptage.
 * Déclaré dans wrangler.toml (lien QUOTAS, migration new_sqlite_classes).
 */
import { DurableObject } from 'cloudflare:workers';

import type { MagasinListable } from './installations';
import { type Invitation, type ObjetInvitations, RegistreInvitations } from './invitations';
import { type ObjetSupervision, RegistreSupervision, type Supervision } from './supervision';
import {
  type BaseSql,
  CLE_GLOBALE,
  cleQuota,
  type EtatQuotaInstallation,
  type Limites,
  lireNombre,
  moisDe,
  type EspaceQuota,
  type ObjetQuota,
  type ObjetTransferable,
  RegistreQuota,
  type Transfert,
  type Utilises,
} from './quota';
import { settings } from './settings';

/** État fourni par Cloudflare au Durable Object (ctx), réduit à ce que le compteur utilise. */
export interface EtatObjet {
  storage: { sql: BaseSql };
  /** Identifiant de l'exemplaire : sa juridiction (« eu ») s'il a été créé dans une juridiction. */
  id?: { jurisdiction?: string };
  blockConcurrencyWhile<T>(action: () => Promise<T>): Promise<T>;
}

/**
 * Ce que le Durable Object lit de l'environnement du Worker : l'espace KV (reprise des compteurs) et
 * l'espace des Durable Objects (transfert depuis l'ancien exemplaire, sans juridiction).
 */
type EnvQuota = { QUOTA: MagasinListable; QUOTAS?: EspaceQuota };

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

export class Quota extends DurableObject<EnvQuota> implements ObjetQuota, ObjetInvitations, ObjetTransferable, ObjetSupervision {
  private readonly registre: RegistreQuota;
  private readonly invitations: RegistreInvitations;
  private readonly statistiques: RegistreSupervision;

  constructor(
    ctx: EtatObjet,
    env: EnvQuota,
    private readonly maintenant: () => Date = () => new Date(),
  ) {
    super(ctx, env);
    this.registre = new RegistreQuota(ctx.storage.sql);
    this.invitations = new RegistreInvitations(ctx.storage.sql);
    this.statistiques = new RegistreSupervision(ctx.storage.sql);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS transfert (fait INTEGER PRIMARY KEY)');
  }

  /**
   * Exemplaire créé dans une juridiction : au premier appel, il reprend une fois le contenu de l'ancien
   * exemplaire (compteurs, mois repris, invitations), qui l'efface en le remettant. Rien ne repart à zéro.
   * En cas d'échec, l'exemplaire fonctionne quand même et réessaiera au prochain appel.
   */
  private async pret(): Promise<void> {
    if (!this.ctx.id?.jurisdiction || !this.env.QUOTAS || this.aTransfere()) return;
    const espace = this.env.QUOTAS;
    await this.ctx.blockConcurrencyWhile(async () => {
      if (this.aTransfere()) return;
      try {
        const contenu = await espace.get(espace.idFromName(settings.nomObjetQuota)).transferer();
        this.registre.importer(contenu);
        this.invitations.importer(contenu.invitations);
        this.ctx.storage.sql.exec('INSERT OR IGNORE INTO transfert (fait) VALUES (1)');
      } catch {
        // Ancien exemplaire injoignable : nouvel essai au prochain appel.
      }
    });
  }

  private aTransfere(): boolean {
    return this.ctx.storage.sql.exec('SELECT fait FROM transfert').toArray().length > 0;
  }

  /** Appelé par l'exemplaire de la juridiction sur l'ancien : remet tout et l'efface. */
  async transferer(): Promise<Transfert> {
    return { ...this.registre.vider(), invitations: this.invitations.vider() };
  }

  /**
   * Mois en cours, après la reprise depuis KV si elle n'a pas encore eu lieu. Pendant la lecture de KV,
   * Cloudflare met les autres demandes en attente (blockConcurrencyWhile).
   */
  private async moisPret(): Promise<string> {
    await this.pret();
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

  async creerInvitation(empreinte: string, nom: string): Promise<Invitation> {
    await this.pret();
    return this.invitations.creer(empreinte, nom, this.maintenant());
  }

  async listerInvitations(): Promise<Invitation[]> {
    await this.pret();
    return this.invitations.lister(this.maintenant());
  }

  async annulerInvitation(id: string): Promise<boolean> {
    await this.pret();
    return this.invitations.annuler(id);
  }

  async utiliserInvitation(empreinte: string): Promise<{ nom: string } | null> {
    await this.pret();
    return this.invitations.utiliser(empreinte, this.maintenant());
  }

  /** Supervision : une requête de plus dans l'heure en cours (aucune donnée sur la requête elle-même). */
  async noterRequete(depuisCache: boolean | null, enErreur: boolean): Promise<void> {
    this.statistiques.noter(depuisCache, enErreur, this.maintenant());
  }

  async supervision(): Promise<Supervision> {
    return this.statistiques.lire(this.maintenant());
  }
}
