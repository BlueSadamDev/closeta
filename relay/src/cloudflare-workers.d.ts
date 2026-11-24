/**
 * Déclaration minimale du module « cloudflare:workers », fourni par Cloudflare au moment de la mise en
 * ligne (pas de paquet npm à installer). Les tests le remplacent par test/cloudflare-workers.ts.
 */
declare module 'cloudflare:workers' {
  export abstract class DurableObject<Env = unknown> {
    protected readonly ctx: import('./quotaObjet').EtatObjet;
    protected readonly env: Env;
    constructor(ctx: import('./quotaObjet').EtatObjet, env: Env);
  }
}
