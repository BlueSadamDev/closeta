/** Remplaçant de « cloudflare:workers » pour les tests (voir vitest.config.ts). */
export abstract class DurableObject<Env = unknown> {
  constructor(
    protected readonly ctx: unknown,
    protected readonly env: Env,
  ) {}
}
