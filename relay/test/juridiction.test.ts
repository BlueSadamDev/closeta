import { describe, expect, it } from 'vitest';

import relais, { type Env } from '../src/index';
import { lireJuridiction } from '../src/quota';
import { magasin } from './kv';
import { espaceQuota } from './quotaObjet';

// Jetons fictifs, propres aux tests.
const JETON = 'jeton-partage-fictif';
const JETON_ADMIN = 'jeton-admin-fictif';

function env(juridiction: string) {
  const kv = magasin();
  const quota = espaceQuota(kv);
  const e: Env = {
    RELAY_TOKEN: JETON,
    ADMIN_TOKEN: JETON_ADMIN,
    LIMITEUR: { limit: async () => ({ success: true }) },
    AI: { run: async () => ({}) },
    PHOTOS: { put: async () => null, get: async () => null, delete: async () => undefined },
    QUOTA: kv,
    QUOTAS: quota.espace,
    JURIDICTION_DONNEES: juridiction,
  };
  return { e, quota };
}

const quota = (e: Env) =>
  relais.fetch(new Request('https://relais.exemple.test/v1/quota', { headers: { authorization: `Bearer ${JETON}` } }), e);

describe('juridiction des compteurs et des invitations', () => {
  it('lit seulement les juridictions connues', () => {
    expect(lireJuridiction(' EU ')).toBe('eu');
    expect(lireJuridiction('')).toBeNull();
    expect(lireJuridiction('mars')).toBeNull();
    expect(lireJuridiction(undefined)).toBeNull();
  });

  it('sans juridiction : l’ancien exemplaire sert, l’exemplaire « eu » n’est jamais créé', async () => {
    const { e, quota: q } = env('');
    expect((await quota(e)).status).toBe(200);
    expect(q.eu()).toBeNull();
  });

  it('avec « eu » : reprend une fois compteurs et invitations de l’ancien exemplaire, qui les efface', async () => {
    const { e, quota: q } = env('eu');
    // Contenu de l'ancien exemplaire, d'avant la juridiction.
    await q.objet.reserver('principale', { global: 250, installation: 250 });
    await q.objet.reserver('principale', { global: 250, installation: 250 });
    await q.objet.creerInvitation('empreinte-fictive', 'Téléphone de Léa');

    const reponse = await quota(e);
    const corps = (await reponse.json()) as { global: { utilise: number } };
    expect(corps.global.utilise).toBe(2);
    expect(q.compteEu()).toBe(2);
    expect(q.compte()).toBe(0);
    expect(q.etat.sql.exec('SELECT * FROM invitation').toArray()).toHaveLength(0);
    expect(await q.eu()?.objet.utiliserInvitation('empreinte-fictive')).toEqual({ nom: 'Téléphone de Léa' });

    // Le transfert n'a lieu qu'une fois : rien n'est compté deux fois.
    await quota(e);
    expect(q.compteEu()).toBe(2);
  });

  it('avec « eu » : les invitations créées passent par l’exemplaire « eu »', async () => {
    const { e, quota: q } = env('eu');
    const r = await relais.fetch(
      new Request('https://relais.exemple.test/v1/admin/invitations', {
        method: 'POST',
        headers: { authorization: `Bearer ${JETON_ADMIN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ nom: 'Alice' }),
      }),
      e,
    );
    expect(r.status).toBe(201);
    expect(q.eu()?.etat.sql.exec('SELECT nom FROM invitation').toArray()).toEqual([{ nom: 'Alice' }]);
    expect(q.etat.sql.exec('SELECT * FROM invitation').toArray()).toHaveLength(0);
  });
});
