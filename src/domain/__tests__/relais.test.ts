import { lireAlternatives } from '../alternatives';
import { lireExtraction } from '../lien';
import { lireIdentification } from '../photo';
import {
  adresseRelais,
  entetesRelais,
  identifiantInstallationValide,
  lireQuota,
  lireTestConnexion,
  nettoyerJeton,
  niveauQuota,
} from '../relais';

// Données fictives.
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

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

describe('recherches du mois (GET /quota)', () => {
  it('lit la réponse du relais', () => {
    expect(lireQuota(200, { utilise: 37, limite: 250, mois: '2026-11' })).toEqual({
      utilise: 37,
      limite: 250,
      mois: '2026-11',
      installation: null,
    });
  });

  it('renvoie null si le relais ne répond pas ou répond autre chose', () => {
    expect(lireQuota(null, null)).toBeNull();
    expect(lireQuota(403, { erreur: 'jeton_refuse' })).toBeNull();
    expect(lireQuota(200, { utilise: '37', limite: 250, mois: '2026-11' })).toBeNull();
    expect(lireQuota(200, { utilise: -1, limite: 250, mois: '2026-11' })).toBeNull();
  });

  it('met en garde à partir de 80 % du seuil, et signale le seuil atteint', () => {
    const q = (utilise: number) => ({ utilise, limite: 250, mois: '2026-11', installation: null });
    expect(niveauQuota(q(0))).toBe('normal');
    expect(niveauQuota(q(199))).toBe('normal');
    expect(niveauQuota(q(200))).toBe('alerte');
    expect(niveauQuota(q(249))).toBe('alerte');
    expect(niveauQuota(q(250))).toBe('atteint');
    expect(niveauQuota(q(260))).toBe('atteint');
  });
});

describe('GET /quota, format par installation (étape 9)', () => {
  it('lit le compteur global et celui du téléphone', () => {
    const corps = { installation: { utilise: 12, limite: 50 }, global: { utilise: 37, limite: 250 }, mois: '2026-11' };
    expect(lireQuota(200, corps)).toEqual({ utilise: 37, limite: 250, mois: '2026-11', installation: { utilise: 12, limite: 50 } });
  });

  it('refuse un compteur global illisible', () => {
    expect(lireQuota(200, { installation: { utilise: 1, limite: 5 }, global: { utilise: 'x' }, mois: '2026-11' })).toBeNull();
    expect(lireQuota(200, { global: { utilise: 1, limite: 5 } })).toBeNull();
  });

  it('seuil du téléphone atteint : « atteint », même si le global ne l’est pas', () => {
    const q = { utilise: 10, limite: 250, mois: '2026-11', installation: { utilise: 50, limite: 50 } };
    expect(niveauQuota(q)).toBe('atteint');
    expect(niveauQuota({ ...q, installation: { utilise: 45, limite: 50 } })).toBe('normal');
    expect(niveauQuota({ ...q, utilise: 250, installation: { utilise: 0, limite: 50 } })).toBe('atteint');
  });
});

describe('identité envoyée au relais', () => {
  it('ajoute le jeton, l’identifiant d’installation et la version', () => {
    expect(entetesRelais({ jeton: 'jeton-fictif', installation: ID, version: '1.0.0' }, { 'Content-Type': 'application/json' })).toEqual({
      Authorization: 'Bearer jeton-fictif',
      'Content-Type': 'application/json',
      'X-ClosetA-Installation': ID,
      'X-ClosetA-Version': '1.0.0',
    });
  });

  it('n’envoie pas un identifiant absent ou mal formé', () => {
    expect(entetesRelais({ jeton: 'j', installation: null, version: null })).toEqual({ Authorization: 'Bearer j' });
    expect(entetesRelais({ jeton: 'j', installation: 'abc', version: null })).toEqual({ Authorization: 'Bearer j' });
  });

  it('reconnaît un UUID', () => {
    expect(identifiantInstallationValide(ID)).toBe(true);
    expect(identifiantInstallationValide('')).toBe(false);
    expect(identifiantInstallationValide(null)).toBe(false);
  });

  it('passe par les routes /v1', () => {
    expect(adresseRelais('https://relais.exemple.test', '/extract')).toBe('https://relais.exemple.test/v1/extract');
    expect(adresseRelais('https://relais.exemple.test/', '/quota')).toBe('https://relais.exemple.test/v1/quota');
  });
});

describe('app trop ancienne pour le relais (HTTP 426)', () => {
  const corps = { erreur: 'mise_a_jour_requise' };
  it('donne « mise_a_jour_requise » partout', () => {
    expect(lireTestConnexion(426, corps)).toBe('mise_a_jour_requise');
    expect(lireExtraction(426, corps, 'https://exemple.test/p')).toEqual({ ok: false, raison: 'mise_a_jour_requise' });
    expect(lireIdentification(426, corps)).toEqual({ ok: false, raison: 'mise_a_jour_requise' });
    expect(lireAlternatives(426, corps)).toEqual({ ok: false, raison: 'mise_a_jour_requise' });
    expect(lireQuota(426, corps)).toBeNull();
  });
});
