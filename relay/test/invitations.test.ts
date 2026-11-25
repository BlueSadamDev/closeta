import { describe, expect, it } from 'vitest';

import relais, { type Env } from '../src/index';
import { empreinteHex } from '../src/installations';
import { ALPHABET_CODE, normaliserCode, nouveauCode, RegistreInvitations } from '../src/invitations';
import { settings } from '../src/settings';
import { magasin } from './kv';
import { baseSql, espaceQuota } from './quotaObjet';

// Jeton fictif, propre aux tests.
const JETON_ADMIN = 'jeton-admin-fictif';
const JOUR = 24 * 3600_000;

function env(options: { maintenant?: () => Date; limiteur?: (cle: string) => boolean } = {}) {
  const kv = magasin();
  const quota = espaceQuota(kv, options.maintenant);
  const cles: string[] = [];
  const limiteur = {
    limit: async ({ key }: { key: string }) => {
      cles.push(key);
      return { success: options.limiteur ? options.limiteur(key) : true };
    },
  };
  const e: Env = {
    ADMIN_TOKEN: JETON_ADMIN,
    LIMITEUR: limiteur,
    LIMITEUR_INVITATION: limiteur,
    AI: { run: async () => ({}) },
    PHOTOS: { put: async () => null, get: async () => null, delete: async () => undefined },
    QUOTA: kv,
    QUOTAS: quota.espace,
  };
  return { e, kv, cles, quota };
}

function requete(chemin: string, options: { methode?: string; jeton?: string | null; corps?: unknown } = {}) {
  const { methode = 'GET', jeton = null, corps } = options;
  const headers: Record<string, string> = { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.7' };
  if (jeton !== null) headers.authorization = `Bearer ${jeton}`;
  return new Request(`https://relais.exemple.test${chemin}`, {
    method: methode,
    headers,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
}

const inviter = (e: Env, nom = 'Téléphone de test') =>
  relais.fetch(requete('/v1/admin/invitations', { methode: 'POST', jeton: JETON_ADMIN, corps: { nom } }), e);
const utiliser = (e: Env, code: unknown) =>
  relais.fetch(requete('/v1/invitations/utiliser', { methode: 'POST', corps: { code } }), e);

describe('codes d’invitation : format', () => {
  it('produit des codes CLST-XXXX-XXXX sans 0, O, 1 ni I', () => {
    for (let i = 0; i < 200; i++) {
      const code = nouveauCode();
      expect(code).toMatch(/^CLST-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(code.slice(5)).not.toMatch(/[01OI]/);
    }
    expect(ALPHABET_CODE).toHaveLength(32);
  });

  it('accepte minuscules, espaces, tirets et code sans préfixe', () => {
    expect(normaliserCode('CLST-7K4Q-9M2P')).toBe('CLST7K4Q9M2P');
    expect(normaliserCode(' clst 7k4q 9m2p ')).toBe('CLST7K4Q9M2P');
    expect(normaliserCode('7K4Q-9M2P')).toBe('CLST7K4Q9M2P');
  });

  it('refuse les codes mal formés', () => {
    expect(normaliserCode('CLST-7K4Q-9M2')).toBeNull();
    expect(normaliserCode('CLST-0K4Q-9M2P')).toBeNull();
    expect(normaliserCode('ABCD-7K4Q-9M2P')).toBeNull();
    expect(normaliserCode(42)).toBeNull();
    expect(normaliserCode(undefined)).toBeNull();
  });
});

describe('codes d’invitation : registre', () => {
  const debut = new Date('2026-11-25T10:00:00Z');

  it('un code ne sert qu’une fois', () => {
    const r = new RegistreInvitations(baseSql());
    r.creer('empreinte-a', 'Alice', debut);
    expect(r.utiliser('empreinte-a', debut)).toEqual({ nom: 'Alice' });
    expect(r.utiliser('empreinte-a', debut)).toBeNull();
  });

  it('un code ne sert plus après 7 jours, et il est effacé', () => {
    const sql = baseSql();
    const r = new RegistreInvitations(sql);
    r.creer('empreinte-a', 'Alice', debut);
    const apres = new Date(debut.getTime() + settings.dureeInvitationMs);
    expect(r.utiliser('empreinte-a', apres)).toBeNull();
    expect(sql.exec('SELECT * FROM invitation').toArray()).toHaveLength(0);
  });

  it('marche encore juste avant 7 jours', () => {
    const r = new RegistreInvitations(baseSql());
    r.creer('empreinte-a', 'Alice', debut);
    expect(r.utiliser('empreinte-a', new Date(debut.getTime() + 7 * JOUR - 1000))).toEqual({ nom: 'Alice' });
  });

  it('une invitation annulée ne sert plus', () => {
    const r = new RegistreInvitations(baseSql());
    const i = r.creer('empreinte-a', 'Alice', debut);
    expect(r.annuler(i.id)).toBe(true);
    expect(r.annuler(i.id)).toBe(false);
    expect(r.utiliser('empreinte-a', debut)).toBeNull();
  });

  it('liste les invitations en attente, sans les expirées', () => {
    const r = new RegistreInvitations(baseSql());
    r.creer('empreinte-a', 'Alice', debut);
    r.creer('empreinte-b', 'Bruno', new Date(debut.getTime() + 2 * JOUR));
    const plusTard = new Date(debut.getTime() + 8 * JOUR);
    expect(r.lister(plusTard).map((i) => i.nom)).toEqual(['Bruno']);
  });
});

describe('codes d’invitation : routes', () => {
  it('crée une invitation, puis le code configure une installation qui fonctionne', async () => {
    const { e } = env();
    const reponse = await inviter(e, 'Téléphone de Bruno');
    expect(reponse.status).toBe(201);
    const { code, invitation } = (await reponse.json()) as { code: string; invitation: { nom: string; expire_le: string } };
    expect(code).toMatch(/^CLST-/);
    expect(invitation.nom).toBe('Téléphone de Bruno');

    const utilise = await utiliser(e, code.toLowerCase());
    expect(utilise.status).toBe(201);
    const { jeton, installation } = (await utilise.json()) as { jeton: string; installation: { nom: string } };
    expect(installation.nom).toBe('Téléphone de Bruno');

    const quota = await relais.fetch(requete('/v1/quota', { jeton }), e);
    expect(quota.status).toBe(200);
  });

  it('refuse un deuxième usage du même code, même lancé en même temps', async () => {
    const { e } = env();
    const { code } = (await (await inviter(e)).json()) as { code: string };
    const reponses = await Promise.all([utiliser(e, code), utiliser(e, code)]);
    expect(reponses.map((r) => r.status).sort()).toEqual([201, 404]);
    expect((await utiliser(e, code)).status).toBe(404);
  });

  it('refuse un code expiré', async () => {
    let maintenant = new Date('2026-11-25T10:00:00Z');
    const { e } = env({ maintenant: () => maintenant });
    const { code } = (await (await inviter(e)).json()) as { code: string };
    maintenant = new Date(maintenant.getTime() + settings.dureeInvitationMs + 1);
    const reponse = await utiliser(e, code);
    expect(reponse.status).toBe(404);
    expect(await reponse.json()).toEqual({ erreur: 'invitation_invalide' });
  });

  it('liste et annule les invitations en attente', async () => {
    const { e } = env();
    const { code } = (await (await inviter(e, 'Alice')).json()) as { code: string };
    const liste = (await (await relais.fetch(requete('/v1/admin/invitations', { jeton: JETON_ADMIN }), e)).json()) as {
      invitations: { id: string; nom: string }[];
    };
    expect(liste.invitations.map((i) => i.nom)).toEqual(['Alice']);
    expect(JSON.stringify(liste)).not.toContain(code);

    const id = liste.invitations[0].id;
    const annulee = await relais.fetch(requete(`/v1/admin/invitations/${id}`, { methode: 'DELETE', jeton: JETON_ADMIN }), e);
    expect(annulee.status).toBe(200);
    expect((await utiliser(e, code)).status).toBe(404);
  });

  it('ne garde que l’empreinte du code, jamais le code', async () => {
    const { e, quota } = env();
    const { code } = (await (await inviter(e)).json()) as { code: string };
    const lignes = quota.etat.sql.exec('SELECT * FROM invitation').toArray();
    expect(JSON.stringify(lignes)).not.toContain(code);
    expect(JSON.stringify(lignes)).not.toContain(code.replace(/-/g, ''));
    expect(lignes[0].empreinte).toBe(await empreinteHex(code.replace(/-/g, '')));
  });

  it('réserve la création et la liste au jeton d’administration', async () => {
    const { e } = env();
    expect((await relais.fetch(requete('/v1/admin/invitations', { methode: 'POST', corps: { nom: 'X' } }), e)).status).toBe(401);
    expect((await relais.fetch(requete('/v1/admin/invitations', { jeton: 'mauvais' }), e)).status).toBe(403);
  });

  it('refuse un nom vide et un code mal formé', async () => {
    const { e } = env();
    expect((await inviter(e, '  ')).status).toBe(400);
    expect((await utiliser(e, 'pas-un-code')).status).toBe(400);
    expect((await utiliser(e, 'CLST-2222-2222')).status).toBe(404);
  });

  it('limite les essais de code par adresse', async () => {
    const { e, cles } = env({ limiteur: (cle) => !cle.startsWith('invitation:') });
    const reponse = await utiliser(e, 'CLST-2222-2222');
    expect(reponse.status).toBe(429);
    expect(cles).toContain('invitation:192.0.2.7');
  });
});
