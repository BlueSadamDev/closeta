import { lireTestConnexion, nettoyerJeton } from '../relais';

describe('nettoyerJeton', () => {
  it('retire les espaces et retours à la ligne autour du jeton', () => {
    expect(nettoyerJeton('  jeton-fictif-123\n')).toBe('jeton-fictif-123');
  });
  it('laisse vide une saisie vide', () => {
    expect(nettoyerJeton('   ')).toBe('');
  });
});

describe('lireTestConnexion', () => {
  it('jeton accepté : le relais refuse seulement la demande vide', () => {
    expect(lireTestConnexion(400, { erreur: 'url_refusee' })).toBe('ok');
    expect(lireTestConnexion(400, { erreur: 'requete_invalide' })).toBe('ok');
  });
  it('jeton absent ou refusé', () => {
    expect(lireTestConnexion(401, { erreur: 'jeton_absent' })).toBe('jeton_absent');
    expect(lireTestConnexion(403, { erreur: 'jeton_refuse' })).toBe('jeton_refuse');
  });
  it('trop de demandes', () => {
    expect(lireTestConnexion(429, { erreur: 'limite' })).toBe('limite');
  });
  it('pas de réponse : relais injoignable', () => {
    expect(lireTestConnexion(null, null)).toBe('injoignable');
  });
  it('toute autre réponse est inattendue, sans conclure que le jeton est bon', () => {
    expect(lireTestConnexion(400, { erreur: 'autre' })).toBe('inattendu');
    expect(lireTestConnexion(400, null)).toBe('inattendu');
    expect(lireTestConnexion(200, {})).toBe('inattendu');
    expect(lireTestConnexion(500, 'panne')).toBe('inattendu');
  });
});
