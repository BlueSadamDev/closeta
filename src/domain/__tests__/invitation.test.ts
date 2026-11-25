import { lireLienConfiguration } from '../configuration';
import {
  lienInvitation,
  lireAnnulationInvitation,
  lireCreationInvitation,
  lireLienInvitation,
  lireListeInvitations,
  lireUtilisationInvitation,
  normaliserCode,
  verifierInvitation,
} from '../invitation';

// Adresse et codes fictifs.
const RELAIS = 'https://relais.exemple.dev';

describe('normaliserCode', () => {
  it('remet le code en forme, quelle que soit la saisie', () => {
    expect(normaliserCode('CLST-7K4Q-9M2P')).toBe('CLST-7K4Q-9M2P');
    expect(normaliserCode(' clst 7k4q 9m2p ')).toBe('CLST-7K4Q-9M2P');
    expect(normaliserCode('7K4Q9M2P')).toBe('CLST-7K4Q-9M2P');
  });

  it('refuse un code trop court, un autre préfixe ou un caractère ambigu (0, O, 1, I)', () => {
    expect(normaliserCode('CLST-7K4Q-9M2')).toBeNull();
    expect(normaliserCode('ABCD-7K4Q-9M2P')).toBeNull();
    expect(normaliserCode('CLST-7K4Q-9M2O')).toBeNull();
    expect(normaliserCode('CLST-1K4Q-9M2P')).toBeNull();
    expect(normaliserCode('')).toBeNull();
    expect(normaliserCode(null)).toBeNull();
  });
});

describe('lien d’invitation', () => {
  it('se relit à l’identique et ne contient aucun jeton', () => {
    const lien = lienInvitation({ relais: RELAIS, code: 'CLST-7K4Q-9M2P' });
    expect(lien).toBe('closeta://invitation?relais=https%3A%2F%2Frelais.exemple.dev&code=CLST-7K4Q-9M2P');
    expect(lien).not.toContain('jeton');
    expect(lireLienInvitation(lien)).toEqual({ ok: true, relais: RELAIS, code: 'CLST-7K4Q-9M2P' });
  });

  it('refuse un autre lien, une adresse non https ou un code mal formé', () => {
    expect(lireLienInvitation('https://exemple.dev')).toEqual({ ok: false, raison: 'etranger' });
    expect(lireLienInvitation('closeta://invitation?relais=http%3A%2F%2Fx.dev&code=CLST-7K4Q-9M2P')).toEqual({
      ok: false,
      raison: 'adresse',
    });
    expect(lireLienInvitation(`closeta://invitation?relais=${encodeURIComponent(RELAIS)}&code=abc`)).toEqual({
      ok: false,
      raison: 'code',
    });
  });

  it('n’est pas pris pour un QR de configuration, et inversement', () => {
    const lien = lienInvitation({ relais: RELAIS, code: 'CLST-7K4Q-9M2P' });
    expect(lireLienConfiguration(lien)).toEqual({ ok: false, raison: 'etranger' });
    expect(lireLienInvitation('closeta://config?relais=x&jeton=y')).toEqual({ ok: false, raison: 'etranger' });
  });

  it('vérifie un code saisi avec l’adresse du téléphone', () => {
    expect(verifierInvitation(RELAIS, '7k4q 9m2p')).toEqual({ ok: true, relais: RELAIS, code: 'CLST-7K4Q-9M2P' });
    expect(verifierInvitation(RELAIS, undefined)).toEqual({ ok: false, raison: 'code' });
  });
});

describe('réponses du relais', () => {
  const invitation = { id: 'i-1', nom: 'Téléphone de Léa', cree_le: '2026-11-25T10:00:00Z', expire_le: '2026-12-02T10:00:00Z' };

  it('lit la liste des invitations en attente', () => {
    expect(lireListeInvitations(200, { invitations: [invitation, { id: 3 }] })).toEqual({
      ok: true,
      invitations: [{ id: 'i-1', nom: 'Téléphone de Léa', expireLe: '2026-12-02T10:00:00Z' }],
    });
    expect(lireListeInvitations(403, null)).toEqual({ ok: false, raison: 'jeton_refuse' });
    expect(lireListeInvitations(null, null)).toEqual({ ok: false, raison: 'injoignable' });
  });

  it('lit la création, avec le code donné une seule fois', () => {
    expect(lireCreationInvitation(201, { invitation, code: 'CLST-7K4Q-9M2P' })).toEqual({
      ok: true,
      invitation: { id: 'i-1', nom: 'Téléphone de Léa', expireLe: '2026-12-02T10:00:00Z' },
      code: 'CLST-7K4Q-9M2P',
    });
    expect(lireCreationInvitation(201, { invitation })).toEqual({ ok: false, raison: 'inattendu' });
    expect(lireCreationInvitation(429, null)).toEqual({ ok: false, raison: 'limite' });
  });

  it('lit l’annulation', () => {
    expect(lireAnnulationInvitation(200)).toEqual({ ok: true });
    expect(lireAnnulationInvitation(404)).toEqual({ ok: false, raison: 'inattendu' });
  });

  it('lit l’utilisation d’un code : jeton, code refusé, limite, relais muet', () => {
    expect(lireUtilisationInvitation(201, { installation: {}, jeton: ' jeton-fictif ' })).toEqual({ ok: true, jeton: 'jeton-fictif' });
    expect(lireUtilisationInvitation(404, { erreur: 'invitation_invalide' })).toEqual({ ok: false, raison: 'invalide' });
    expect(lireUtilisationInvitation(400, null)).toEqual({ ok: false, raison: 'invalide' });
    expect(lireUtilisationInvitation(429, null)).toEqual({ ok: false, raison: 'limite' });
    expect(lireUtilisationInvitation(null, null)).toEqual({ ok: false, raison: 'injoignable' });
    expect(lireUtilisationInvitation(201, {})).toEqual({ ok: false, raison: 'inattendu' });
  });
});
