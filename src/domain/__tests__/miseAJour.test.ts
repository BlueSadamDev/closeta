import {
  apresVerification,
  aVerifier,
  ETAT_VIDE,
  lireEtatMiseAJour,
  lireVersionPubliee,
  versionAProposer,
  versionPlusRecente,
} from '../miseAJour';

// Adresse de release fictive.
const URL_RELEASE = 'https://github.com/exemple/closeta-test/releases/tag/v1.2.0';
const MAINTENANT = new Date('2026-11-25T12:00:00Z');
const HEURE = 3600_000;

describe('versionPlusRecente', () => {
  it('compare champ par champ, pas comme du texte', () => {
    expect(versionPlusRecente('1.0.0', '1.2.0')).toBe(true);
    expect(versionPlusRecente('1.9.0', '1.10.0')).toBe(true);
    expect(versionPlusRecente('2.0.0', '1.10.0')).toBe(false);
    expect(versionPlusRecente('1.2.0', '1.2.0')).toBe(false);
  });

  it('ne propose rien si une version est illisible', () => {
    expect(versionPlusRecente(undefined, '1.2.0')).toBe(false);
    expect(versionPlusRecente('1.0.0', 'v1.2')).toBe(false);
  });
});

describe('lireVersionPubliee', () => {
  it('lit la réponse du relais', () => {
    expect(lireVersionPubliee(200, { derniere: '1.2.0', url: URL_RELEASE })).toEqual({ derniere: '1.2.0', url: URL_RELEASE });
  });

  it('ignore une version inconnue, une adresse hors GitHub ou un relais muet', () => {
    expect(lireVersionPubliee(200, { derniere: null, url: null })).toBeNull();
    expect(lireVersionPubliee(200, { derniere: '1.2.0', url: 'https://exemple.test/apk' })).toBeNull();
    expect(lireVersionPubliee(null, null)).toBeNull();
    expect(lireVersionPubliee(403, { derniere: '1.2.0', url: URL_RELEASE })).toBeNull();
  });
});

describe('rythme des vérifications', () => {
  it('vérifie au premier lancement, puis au plus une fois par 24 h', () => {
    expect(aVerifier(ETAT_VIDE, MAINTENANT)).toBe(true);
    const verifie = apresVerification(ETAT_VIDE, { derniere: '1.2.0', url: URL_RELEASE }, MAINTENANT);
    expect(aVerifier(verifie, new Date(MAINTENANT.getTime() + 23 * HEURE))).toBe(false);
    expect(aVerifier(verifie, new Date(MAINTENANT.getTime() + 24 * HEURE))).toBe(true);
  });

  it('revérifie si la date gardée est dans le futur ou illisible', () => {
    expect(aVerifier({ ...ETAT_VIDE, verifieLe: '2027-01-01T00:00:00Z' }, MAINTENANT)).toBe(true);
    expect(aVerifier({ ...ETAT_VIDE, verifieLe: 'n’importe quoi' }, MAINTENANT)).toBe(true);
  });

  it('relit l’état gardé, ou repart de zéro s’il est illisible', () => {
    const etat = apresVerification(ETAT_VIDE, { derniere: '1.2.0', url: URL_RELEASE }, MAINTENANT);
    expect(lireEtatMiseAJour(JSON.stringify(etat))).toEqual(etat);
    expect(lireEtatMiseAJour('{')).toEqual(ETAT_VIDE);
    expect(lireEtatMiseAJour(null)).toEqual(ETAT_VIDE);
  });
});

describe('versionAProposer', () => {
  const etat = apresVerification(ETAT_VIDE, { derniere: '1.2.0', url: URL_RELEASE }, MAINTENANT);

  it('propose une version plus récente que celle installée', () => {
    expect(versionAProposer(etat, '1.0.0')).toEqual({ derniere: '1.2.0', url: URL_RELEASE });
    expect(versionAProposer(etat, '1.2.0')).toBeNull();
  });

  it('la croix masque cette version dans le bandeau, pas dans les Réglages, et la suivante revient', () => {
    const masquee = { ...etat, masquee: '1.2.0' };
    expect(versionAProposer(masquee, '1.0.0')).toBeNull();
    expect(versionAProposer(masquee, '1.0.0', true)).toEqual({ derniere: '1.2.0', url: URL_RELEASE });
    const suivante = apresVerification(masquee, { derniere: '1.3.0', url: URL_RELEASE }, MAINTENANT);
    expect(versionAProposer(suivante, '1.0.0')?.derniere).toBe('1.3.0');
  });
});
