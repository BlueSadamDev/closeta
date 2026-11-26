import { afterEach, describe, expect, it, vi } from 'vitest';

import { fournisseurRecherche } from '../src/fournisseur';

// Clé fictive, propre aux tests.
const CLE = 'cle-fictive-123';

describe('choix du fournisseur de recherche', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prend SerpApi par défaut, et aussi quand il est nommé', () => {
    expect(fournisseurRecherche({ SERPAPI_KEY: CLE })?.nom).toBe('serpapi');
    expect(fournisseurRecherche({ SERPAPI_KEY: CLE, RECHERCHE_FOURNISSEUR: ' SerpApi ' })?.nom).toBe('serpapi');
  });

  it('aucun fournisseur sans clé, ou pour un fournisseur inconnu', () => {
    expect(fournisseurRecherche({})).toBeNull();
    expect(fournisseurRecherche({ SERPAPI_KEY: CLE, RECHERCHE_FOURNISSEUR: 'autre' })).toBeNull();
  });

  it('une erreur du fournisseur ne contient jamais la clé', async () => {
    vi.stubGlobal('fetch', vi.fn(async (adresse: string) => {
      throw new Error(`échec réseau vers ${adresse}`);
    }));
    const f = fournisseurRecherche({ SERPAPI_KEY: CLE });
    await expect(f?.lens('https://relais.exemple.test/photo/abc', false)).rejects.toThrow(/\*\*\*/);
    const erreur = await f?.shopping('veste velours').catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(Error);
    expect((erreur as Error).message).not.toContain(CLE);
  });
});
