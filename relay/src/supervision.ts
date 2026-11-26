/**
 * Supervision du relais (docs/SPEC.md, « Lot 4 », « Étape 5 ») : une ligne de journal JSON par requête et
 * des compteurs par heure (requêtes, réponses depuis le catalogue, erreurs), lus par GET /v1/admin/etat.
 *
 * Règle : **jamais** de jeton, d'identifiant d'installation, d'adresse IP, d'URL de photo ni de requête de
 * recherche dans le journal. Seuls y entrent : la route sous forme de modèle (« /v1/photo/:id »), le statut
 * HTTP, la durée, `depuis_cache` et le code d'erreur du relais (liste fermée).
 */
import type { BaseSql } from './quota';
import { settings } from './settings';

/** Ligne de journal : rien d'autre que ces champs. */
export type EntreeJournal = {
  route: string;
  statut: number;
  duree_ms: number;
  depuis_cache?: boolean;
  erreur?: string;
};

/** Routes connues, sous forme de modèle : un identifiant ou une adresse ne passe jamais dans le journal. */
const MODELES: [RegExp, string][] = [
  [/^(?:\/v1)?\/photo\/[^/]+$/, '/v1/photo/:id'],
  [/^\/v1\/admin\/installations\/[^/]+$/, '/v1/admin/installations/:id'],
  [/^\/v1\/admin\/invitations\/[^/]+$/, '/v1/admin/invitations/:id'],
];
const ROUTES_CONNUES = [
  '/extract', '/identify', '/alternatives', '/quota', '/version',
  '/admin/installations', '/admin/invitations', '/admin/etat', '/invitations/utiliser',
];

/** « POST /v1/extract », « GET /v1/photo/:id » ; « autre » pour une adresse inconnue (jamais recopiée). */
export function routeDuJournal(methode: string, chemin: string): string {
  for (const [motif, modele] of MODELES) if (motif.test(chemin)) return `${methode} ${modele}`;
  const sansPrefixe = chemin.startsWith('/v1/') ? chemin.slice(3) : chemin;
  return ROUTES_CONNUES.includes(sansPrefixe) ? `${methode} /v1${sansPrefixe}` : `${methode} autre`;
}

/**
 * Indicateurs lus dans la réponse JSON du relais : `depuis_cache` (booléen) et le code d'erreur (mot du
 * relais, en minuscules ; tout autre texte est ignoré). La réponse elle-même n'est pas modifiée.
 */
export async function indicateurs(reponse: Response): Promise<Pick<EntreeJournal, 'depuis_cache' | 'erreur'>> {
  if (!(reponse.headers.get('content-type') ?? '').includes('application/json')) return {};
  try {
    const corps = (await reponse.clone().json()) as Record<string, unknown> | null;
    if (!corps || typeof corps !== 'object') return {};
    const resultat: Pick<EntreeJournal, 'depuis_cache' | 'erreur'> = {};
    if (typeof corps.depuis_cache === 'boolean') resultat.depuis_cache = corps.depuis_cache;
    if (typeof corps.erreur === 'string' && /^[a-z_]{1,40}$/.test(corps.erreur)) resultat.erreur = corps.erreur;
    return resultat;
  } catch {
    return {};
  }
}

/** Une réponse compte comme erreur à partir du statut 500 (panne du relais ou d'un service qu'il appelle). */
export const estErreur = (statut: number) => statut >= 500;

/** État de GET /v1/admin/etat sur les dernières 24 heures. */
export type Supervision = {
  requetes: number;
  /** Réponses de /extract, /identify et /alternatives (celles qui disent si elles viennent du catalogue). */
  avec_cache_possible: number;
  depuis_cache: number;
  erreurs: number;
};

/** Ce que le Worker demande au Durable Object pour la supervision. */
export interface ObjetSupervision {
  noterRequete(depuisCache: boolean | null, enErreur: boolean): Promise<void>;
  supervision(): Promise<Supervision>;
}

const heureDe = (d: Date) => Math.floor(d.getTime() / 3_600_000);

/** Compteurs par heure, dans la base SQLite du Durable Object ; plus de 48 h : effacés. */
export class RegistreSupervision {
  constructor(private readonly sql: BaseSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS statistique (
      heure INTEGER PRIMARY KEY, requetes INTEGER NOT NULL DEFAULT 0, avec_cache_possible INTEGER NOT NULL DEFAULT 0,
      depuis_cache INTEGER NOT NULL DEFAULT 0, erreurs INTEGER NOT NULL DEFAULT 0)`);
  }

  noter(depuisCache: boolean | null, enErreur: boolean, maintenant: Date) {
    const heure = heureDe(maintenant);
    this.sql.exec(
      `INSERT INTO statistique (heure, requetes, avec_cache_possible, depuis_cache, erreurs) VALUES (?, 1, ?, ?, ?)
       ON CONFLICT (heure) DO UPDATE SET requetes = requetes + 1,
         avec_cache_possible = avec_cache_possible + excluded.avec_cache_possible,
         depuis_cache = depuis_cache + excluded.depuis_cache, erreurs = erreurs + excluded.erreurs`,
      heure, depuisCache === null ? 0 : 1, depuisCache ? 1 : 0, enErreur ? 1 : 0,
    );
    this.sql.exec('DELETE FROM statistique WHERE heure < ?', heure - settings.heuresSupervisionGardees + 1);
  }

  /** Totaux des 24 dernières heures (l'heure en cours comprise). */
  lire(maintenant: Date): Supervision {
    const depuis = heureDe(maintenant) - settings.heuresSupervision + 1;
    const l = this.sql
      .exec(
        `SELECT COALESCE(SUM(requetes), 0) AS requetes, COALESCE(SUM(avec_cache_possible), 0) AS avec_cache_possible,
           COALESCE(SUM(depuis_cache), 0) AS depuis_cache, COALESCE(SUM(erreurs), 0) AS erreurs
         FROM statistique WHERE heure >= ?`,
        depuis,
      )
      .toArray()[0] ?? {};
    return {
      requetes: Number(l.requetes ?? 0),
      avec_cache_possible: Number(l.avec_cache_possible ?? 0),
      depuis_cache: Number(l.depuis_cache ?? 0),
      erreurs: Number(l.erreurs ?? 0),
    };
  }
}
