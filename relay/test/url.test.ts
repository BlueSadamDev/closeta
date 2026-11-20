import { describe, expect, it } from 'vitest';

import { urlPublique } from '../src/url';

describe('adresses acceptées par /extract', () => {
  it.each(['https://boutique.exemple.test/produit/veste', 'https://www.exemple.test:443/p?a=1'])('accepte %s', (u) => {
    expect(urlPublique(u)).not.toBeNull();
  });

  it.each([
    'http://boutique.exemple.test/produit',
    'ftp://exemple.test/f',
    'https://127.0.0.1/admin',
    'https://10.0.0.5/',
    'https://192.168.1.1/',
    'https://2130706433/',
    'https://0x7f.0.0.1/',
    'https://[::1]/',
    'https://localhost/',
    'https://imprimante.local/',
    'https://serveur.internal/',
    'https://intranet/',
    'https://exemple.test:8080/',
    'https://moi:secret@exemple.test/',
    'pas une adresse',
    42,
    null,
  ])('refuse %s', (u) => {
    expect(urlPublique(u)).toBeNull();
  });
});
