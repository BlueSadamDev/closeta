import {
  adresseEnVigueur,
  hoteRelais,
  lienConfiguration,
  lireAdresseRelais,
  lireCreationInstallation,
  lireLienConfiguration,
  lireListeInstallations,
  lireNomInstallation,
  lireRevocation,
  verifierConfiguration,
} from '../configuration';
import { settings } from '../settings';

// Données fictives.
const RELAIS = 'https://relais-fictif.exemple.dev';
const JETON = 'jeton-fictif_AbC-123';

describe('lireAdresseRelais', () => {
  it('accepte une adresse https et retire le « / » final', () => {
    expect(lireAdresseRelais(`  ${RELAIS}/ `)).toEqual({ ok: true, adresse: RELAIS });
    expect(lireAdresseRelais('https://relais.exemple.dev:8443/chemin')).toEqual({
      ok: true,
      adresse: 'https://relais.exemple.dev:8443/chemin',
    });
  });
  it('refuse http, une adresse vide ou sans hôte', () => {
    expect(lireAdresseRelais('http://relais.exemple.dev').ok).toBe(false);
    expect(lireAdresseRelais('').ok).toBe(false);
    expect(lireAdresseRelais(null).ok).toBe(false);
    expect(lireAdresseRelais('https://').ok).toBe(false);
    expect(lireAdresseRelais('relais.exemple.dev').ok).toBe(false);
  });
  it('refuse les identifiants, requêtes, ancres et espaces', () => {
    expect(lireAdresseRelais('https://moi:secret@relais.exemple.dev').ok).toBe(false);
    expect(lireAdresseRelais('https://relais.exemple.dev/?a=1').ok).toBe(false);
    expect(lireAdresseRelais('https://relais.exemple.dev/#x').ok).toBe(false);
    expect(lireAdresseRelais('https://relais exemple.dev').ok).toBe(false);
  });
});

describe('adresseEnVigueur', () => {
  it('sans adresse rangée : celle de settings.ts (téléphone actuel inchangé)', () => {
    expect(adresseEnVigueur(null)).toBe(settings.relayUrl);
    expect(adresseEnVigueur('')).toBe(settings.relayUrl);
  });
  it('adresse rangée valide : elle est utilisée', () => {
    expect(adresseEnVigueur(`${RELAIS}/`)).toBe(RELAIS);
  });
  it('adresse rangée invalide : retour à celle de settings.ts', () => {
    expect(adresseEnVigueur('http://relais.exemple.dev')).toBe(settings.relayUrl);
  });
});

describe('QR de configuration', () => {
  it('fabrique puis relit le même lien', () => {
    const lien = lienConfiguration({ relais: RELAIS, jeton: JETON });
    expect(lien.startsWith('closeta://config?relais=')).toBe(true);
    expect(lireLienConfiguration(lien)).toEqual({ ok: true, relais: RELAIS, jeton: JETON });
  });
  it('encode les caractères spéciaux du jeton', () => {
    const jeton = 'a+b/c=d&e';
    expect(lireLienConfiguration(lienConfiguration({ relais: RELAIS, jeton }))).toEqual({ ok: true, relais: RELAIS, jeton });
  });
  it('accepte les paramètres dans l’autre ordre', () => {
    expect(lireLienConfiguration(`closeta://config?jeton=${JETON}&relais=${encodeURIComponent(RELAIS)}`)).toEqual({
      ok: true,
      relais: RELAIS,
      jeton: JETON,
    });
  });
  it('refuse un QR étranger', () => {
    expect(lireLienConfiguration('https://boutique.exemple.dev/veste')).toEqual({ ok: false, raison: 'etranger' });
    expect(lireLienConfiguration('autreappli://config?relais=x&jeton=y')).toEqual({ ok: false, raison: 'etranger' });
    expect(lireLienConfiguration('closeta://autre?relais=x')).toEqual({ ok: false, raison: 'etranger' });
    expect(lireLienConfiguration('')).toEqual({ ok: false, raison: 'etranger' });
  });
  it('refuse une adresse qui n’est pas en https', () => {
    expect(lireLienConfiguration(`closeta://config?relais=${encodeURIComponent('http://relais.exemple.dev')}&jeton=${JETON}`)).toEqual({
      ok: false,
      raison: 'adresse',
    });
    expect(lireLienConfiguration(`closeta://config?jeton=${JETON}`)).toEqual({ ok: false, raison: 'adresse' });
  });
  it('refuse un jeton vide ou absent', () => {
    expect(lireLienConfiguration(`closeta://config?relais=${encodeURIComponent(RELAIS)}&jeton=`)).toEqual({ ok: false, raison: 'jeton' });
    expect(lireLienConfiguration(`closeta://config?relais=${encodeURIComponent(RELAIS)}&jeton=%20%20`)).toEqual({
      ok: false,
      raison: 'jeton',
    });
    expect(lireLienConfiguration(`closeta://config?relais=${encodeURIComponent(RELAIS)}`)).toEqual({ ok: false, raison: 'jeton' });
  });
  it('résiste à un encodage cassé', () => {
    expect(lireLienConfiguration('closeta://config?relais=%E0%A4%A&jeton=x')).toEqual({ ok: false, raison: 'adresse' });
  });
  it('vérifie aussi les paramètres d’un lien ouvert par Android', () => {
    expect(verifierConfiguration(RELAIS, JETON)).toEqual({ ok: true, relais: RELAIS, jeton: JETON });
    expect(verifierConfiguration(['x'], JETON)).toEqual({ ok: false, raison: 'adresse' });
    expect(verifierConfiguration(RELAIS, undefined)).toEqual({ ok: false, raison: 'jeton' });
  });
});

describe('hoteRelais', () => {
  it('garde seulement l’hôte', () => {
    expect(hoteRelais('https://relais.exemple.dev/chemin')).toBe('relais.exemple.dev');
  });
});

describe('installations', () => {
  const liste = {
    installations: [
      { id: 'principale', nom: 'Principale', cree_le: null, actif: true, utilise: 12 },
      { id: 'id-fictif-1', nom: 'Téléphone fictif', cree_le: '2026-11-20T10:00:00.000Z', actif: false, utilise: 0 },
      { id: 42, nom: 'illisible' },
    ],
    mois: '2026-11',
  };

  it('lit la liste et écarte les entrées illisibles', () => {
    expect(lireListeInstallations(200, liste)).toEqual({
      ok: true,
      installations: [
        { id: 'principale', nom: 'Principale', creeLe: null, actif: true, utilise: 12 },
        { id: 'id-fictif-1', nom: 'Téléphone fictif', creeLe: '2026-11-20T10:00:00.000Z', actif: false, utilise: 0 },
      ],
    });
  });
  it('jeton d’administration absent, refusé, limite, relais injoignable', () => {
    expect(lireListeInstallations(401, null)).toEqual({ ok: false, raison: 'jeton_absent' });
    expect(lireListeInstallations(403, null)).toEqual({ ok: false, raison: 'jeton_refuse' });
    expect(lireListeInstallations(429, null)).toEqual({ ok: false, raison: 'limite' });
    expect(lireListeInstallations(null, null)).toEqual({ ok: false, raison: 'injoignable' });
    expect(lireListeInstallations(200, { autre: 1 })).toEqual({ ok: false, raison: 'inattendu' });
  });
  it('lit la création : installation et jeton donné une seule fois', () => {
    const corps = {
      installation: { id: 'id-fictif-2', nom: 'Second', cree_le: '2026-11-24T08:00:00.000Z', actif: true },
      jeton: JETON,
    };
    expect(lireCreationInstallation(201, corps)).toEqual({
      ok: true,
      installation: { id: 'id-fictif-2', nom: 'Second', creeLe: '2026-11-24T08:00:00.000Z', actif: true, utilise: 0 },
      jeton: JETON,
    });
    expect(lireCreationInstallation(201, { installation: corps.installation })).toEqual({ ok: false, raison: 'inattendu' });
    expect(lireCreationInstallation(403, null)).toEqual({ ok: false, raison: 'jeton_refuse' });
  });
  it('lit la révocation', () => {
    expect(lireRevocation(200)).toEqual({ ok: true });
    expect(lireRevocation(404)).toEqual({ ok: false, raison: 'inattendu' });
  });
  it('nom d’un nouveau téléphone : non vide, raccourci', () => {
    expect(lireNomInstallation('  Téléphone fictif ')).toBe('Téléphone fictif');
    expect(lireNomInstallation('   ')).toBeNull();
    expect(lireNomInstallation('x'.repeat(60))).toHaveLength(settings.nomInstallationMax);
  });
});
