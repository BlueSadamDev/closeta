import { vi } from 'vitest';

/** Faux espace Cloudflare KV, en mémoire, pour les tests. */
export function magasin(initial: Record<string, string> = {}) {
  const cases = new Map(Object.entries(initial));
  return {
    cases,
    get: vi.fn(async (cle: string) => cases.get(cle) ?? null),
    put: vi.fn(async (cle: string, valeur: string, _options?: { expirationTtl?: number }) => void cases.set(cle, valeur)),
    delete: vi.fn(async (cle: string) => void cases.delete(cle)),
    list: vi.fn(async ({ prefix }: { prefix: string; cursor?: string }) => ({
      keys: [...cases.keys()].filter((c) => c.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    })),
  };
}
