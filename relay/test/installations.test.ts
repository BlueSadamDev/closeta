import { afterEach, describe, expect, it, vi } from 'vitest';

import relais, { type Env } from '../src/index';
import { empreinteHex, PRINCIPALE } from '../src/installations';
import { cleQuota, moisDe } from '../src/quota';
import { miseAJourRequise } from '../src/version';
import lens from './fixtures/lens.json';
import shopping from './fixtures/shopping.json';
import { magasin } from './kv';

// Jetons fictifs, propres aux tests.
const JETON_PARTAGE = 'jeton-partage-fictif';
const JETON_ADMIN = 'jeton-admin-fictif';
const ID_APP = '0f8fad5b-d9cb-469f-a165-70867728950e';
const PHOTO = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const DESCRIPTION_IA = { type: 'vetement', categorie: 'Veste', couleur: 'marron', recherche: 'veste velours marron' };
const CE_MOIS = () => moisDe(new Date());

function env(options: { quota?: Record<string, string>; vars?: Partial<Env>; limiteur?: (cle: string) => boolean } = {}) {
  const kv = magasin(options.quota);
  const cles: string[] = [];
  const e: Env = {
    RELAY_TOKEN: JETON_PARTAGE,
    ADMIN_TOKEN: JETON_ADMIN,
    SERPAPI_KEY: 'cle-fictive',
    LIMITEUR: {
      limit: async ({ key }) => {
        cles.push(key);
        return { success: options.limiteur ? options.limiteur(key) : true };
      },
    },
    AI: { run: async () => ({ choices: [{ message: { content: JSON.stringify(DESCRIPTION_IA) } }] }) },
    PHOTOS: { put: async () => null, get: async () => null, delete: async () => undefined },
    QUOTA: kv,
    ...options.vars,
  };
  return { e, kv, cles };
}

function requete(chemin: string, options: { methode?: string; jeton?: string | null; corps?: unknown; entetes?: Record<string, string> } = {}) {
  const { methode = 'GET', jeton = JETON_PARTAGE, corps, entetes = {} } = options;
  const headers: Record<string, string> = { 'content-type': 'application/json', ...entetes };
  if (jeton !== null) headers.authorization = `Bearer ${jeton}`;
  return new Request(`https://relais.exemple.test${chemin}`, {
    method: methode,
    headers,
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
}

const envoiPhoto = (jeton: string) =>
  new Request('https://relais.exemple.test/v1/identify', {
    method: 'POST',
    headers: { 'content-type': 'image/jpeg', authorization: `Bearer ${jeton}` },
    body: PHOTO,
  });

const jsonOk = (corps: unknown) => new Response(JSON.stringify(corps), { headers: { 'content-type': 'application/json' } });

/** Crée une installation par la route d'administration ; renvoie son id et son jeton. */
async function creer(e: Env, nom = 'Téléphone fictif'): Promise<{ id: string; jeton: string }> {
  const r = await relais.fetch(requete('/v1/admin/installations', { methode: 'POST', jeton: JETON_ADMIN, corps: { nom } }), e);
  expect(r.status).toBe(201);
  const corps = (await r.json()) as { installation: { id: string }; jeton: string };
  return { id: corps.installation.id, jeton: corps.jeton };
}

afterEach(() => vi.unstubAllGlobals());

describe('jetons par installation', () => {
  it('l’ancien jeton partagé reste accepté (installation « Principale »)', async () => {
    const { e } = env();
    const r = await relais.fetch(requete('/v1/extract', { methode: 'POST', corps: {} }), e);
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ erreur: 'url_refusee' });
  });

  it('refuse un jeton inconnu', async () => {
    const { e } = env();
    const r = await relais.fetch(requete('/v1/quota', { jeton: 'inconnu' }), e);
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({ erreur: 'jeton_refuse' });
  });

  it('accepte le jeton d’une installation créée, et ne garde que son empreinte', async () => {
    const { e, kv } = env();
    const { id, jeton } = await creer(e);
    expect((await relais.fetch(requete('/v1/quota', { jeton }), e)).status).toBe(200);
    const valeurs = [...kv.cases.entries()].flat();
    expect(valeurs.some((v) => v.includes(jeton))).toBe(false);
    expect(kv.cases.get(`jeton:${await empreinteHex(jeton)}`)).toBe(id);
  });

  it('refuse un jeton révoqué, les autres continuent', async () => {
    const { e } = env();
    const a = await creer(e, 'A');
    const b = await creer(e, 'B');
    const r = await relais.fetch(requete(`/v1/admin/installations/${a.id}`, { methode: 'DELETE', jeton: JETON_ADMIN }), e);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { installation: { actif: boolean } }).installation.actif).toBe(false);
    expect((await relais.fetch(requete('/v1/quota', { jeton: a.jeton }), e)).status).toBe(403);
    expect((await relais.fetch(requete('/v1/quota', { jeton: b.jeton }), e)).status).toBe(200);
    expect((await relais.fetch(requete('/v1/quota'), e)).status).toBe(200);
  });

  it('le jeton d’administration n’ouvre pas les routes de l’app', async () => {
    const { e } = env();
    expect((await relais.fetch(requete('/v1/quota', { jeton: JETON_ADMIN }), e)).status).toBe(403);
  });

  it('refuse un identifiant d’installation mal formé, accepte son absence', async () => {
    const { e } = env();
    const mal = await relais.fetch(requete('/v1/quota', { entetes: { 'x-closeta-installation': 'abc' } }), e);
    expect(mal.status).toBe(400);
    const bien = await relais.fetch(requete('/v1/quota', { entetes: { 'x-closeta-installation': ID_APP } }), e);
    expect(bien.status).toBe(200);
    expect((await relais.fetch(requete('/v1/quota'), e)).status).toBe(200);
  });

  it('limite le débit par installation', async () => {
    const { e, cles } = env();
    const { id, jeton } = await creer(e);
    await relais.fetch(requete('/v1/quota', { jeton }), e);
    await relais.fetch(requete('/v1/quota'), e);
    expect(cles).toContain(`installation:${id}`);
    expect(cles).toContain(`installation:${PRINCIPALE.id}`);
    const bloque = env({ limiteur: (cle) => cle !== `installation:${PRINCIPALE.id}` });
    expect((await relais.fetch(requete('/v1/quota'), bloque.e)).status).toBe(429);
  });
});

describe('administration des installations', () => {
  it('refuse sans jeton, avec le jeton partagé, ou si ADMIN_TOKEN n’existe pas', async () => {
    const { e } = env();
    expect((await relais.fetch(requete('/v1/admin/installations', { jeton: null }), e)).status).toBe(401);
    expect((await relais.fetch(requete('/v1/admin/installations'), e)).status).toBe(403);
    const sansAdmin = env({ vars: { ADMIN_TOKEN: undefined } }).e;
    expect((await relais.fetch(requete('/v1/admin/installations', { jeton: JETON_ADMIN }), sansAdmin)).status).toBe(403);
  });

  it('n’existe pas sans le préfixe /v1', async () => {
    const { e } = env();
    expect((await relais.fetch(requete('/admin/installations', { jeton: JETON_ADMIN }), e)).status).toBe(404);
  });

  it('crée une installation : jeton renvoyé une seule fois, absent de la liste', async () => {
    const { e } = env();
    const { id, jeton } = await creer(e, '  Téléphone de test  ');
    const r = await relais.fetch(requete('/v1/admin/installations', { jeton: JETON_ADMIN }), e);
    expect(r.status).toBe(200);
    const texte = await r.text();
    expect(texte).not.toContain(jeton);
    const corps = JSON.parse(texte) as { installations: { id: string; nom: string; actif: boolean; utilise: number }[]; mois: string };
    expect(corps.mois).toBe(CE_MOIS());
    expect(corps.installations.map((i) => i.id)).toEqual([PRINCIPALE.id, id]);
    expect(corps.installations[1]).toMatchObject({ nom: 'Téléphone de test', actif: true, utilise: 0 });
  });

  it('refuse un nom vide', async () => {
    const { e } = env();
    const r = await relais.fetch(requete('/v1/admin/installations', { methode: 'POST', jeton: JETON_ADMIN, corps: { nom: '  ' } }), e);
    expect(r.status).toBe(400);
  });

  it('révocation : installation inconnue, Principale non révocable', async () => {
    const { e } = env();
    const inconnue = await relais.fetch(requete('/v1/admin/installations/nulle-part', { methode: 'DELETE', jeton: JETON_ADMIN }), e);
    expect(inconnue.status).toBe(404);
    expect(await inconnue.json()).toEqual({ erreur: 'installation_inconnue' });
    const principale = await relais.fetch(requete('/v1/admin/installations/principale', { methode: 'DELETE', jeton: JETON_ADMIN }), e);
    expect(principale.status).toBe(400);
  });
});

describe('quota par installation', () => {
  it('compte chaque recherche dans la case de l’installation et dans la case globale', async () => {
    const { e, kv } = env();
    const { id, jeton } = await creer(e);
    vi.stubGlobal('fetch', vi.fn(async (a: string) => jsonOk(a.includes('google_lens') ? lens : shopping)));
    expect((await relais.fetch(envoiPhoto(jeton), e)).status).toBe(200);
    expect(kv.cases.get(cleQuota(CE_MOIS()))).toBe('2');
    expect(kv.cases.get(cleQuota(CE_MOIS(), id))).toBe('2');
    const r = await relais.fetch(requete('/v1/quota', { jeton }), e);
    expect(await r.json()).toEqual({ installation: { utilise: 2, limite: 250 }, global: { utilise: 2, limite: 250 }, mois: CE_MOIS() });
  });

  it('seuil de l’installation atteint : refusée, les autres continuent', async () => {
    const { e } = env({ vars: { SERPAPI_LIMITE_INSTALLATION: '5' } });
    const { id, jeton } = await creer(e);
    await e.QUOTA.put(cleQuota(CE_MOIS(), id), '5');
    const espion = vi.fn(async (a: string) => jsonOk(a.includes('google_lens') ? lens : shopping));
    vi.stubGlobal('fetch', espion);
    const r = await relais.fetch(envoiPhoto(jeton), e);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ erreur: 'quota_atteint' });
    expect(espion).not.toHaveBeenCalled();
    expect((await relais.fetch(envoiPhoto(JETON_PARTAGE), e)).status).toBe(200);
  });

  it('seuil global atteint : refusé pour tout le monde (limite dure)', async () => {
    const { e } = env({ quota: { [cleQuota(CE_MOIS())]: '250' } });
    const { jeton } = await creer(e);
    const r = await relais.fetch(envoiPhoto(jeton), e);
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ erreur: 'quota_atteint' });
  });
});

describe('versions et alias', () => {
  it('les adresses sans /v1 restent des alias', async () => {
    const { e } = env();
    const ancien = await relais.fetch(requete('/quota'), e);
    const nouveau = await relais.fetch(requete('/v1/quota'), e);
    expect(ancien.status).toBe(200);
    expect(await ancien.json()).toEqual(await nouveau.json());
    expect((await relais.fetch(requete('/extract', { methode: 'POST', corps: {} }), e)).status).toBe(400);
    expect((await relais.fetch(requete('/v1/autre'), e)).status).toBe(404);
  });

  it('VERSION_APP_MIN : une app trop ancienne reçoit « mise_a_jour_requise » (426)', async () => {
    const { e } = env({ vars: { VERSION_APP_MIN: '1.2.0' } });
    const vieille = await relais.fetch(requete('/v1/quota', { entetes: { 'x-closeta-version': '1.1.9' } }), e);
    expect(vieille.status).toBe(426);
    expect(await vieille.json()).toEqual({ erreur: 'mise_a_jour_requise' });
    // Ancien APK, qui n'envoie pas sa version.
    expect((await relais.fetch(requete('/quota'), e)).status).toBe(426);
    expect((await relais.fetch(requete('/v1/quota', { entetes: { 'x-closeta-version': '1.2.0' } }), e)).status).toBe(200);
  });

  it('VERSION_APP_MIN vide : aucune exigence, même sans version', async () => {
    const { e } = env({ vars: { VERSION_APP_MIN: '' } });
    expect((await relais.fetch(requete('/quota'), e)).status).toBe(200);
  });

  it('le jeton est contrôlé avant la version', async () => {
    const { e } = env({ vars: { VERSION_APP_MIN: '9.0.0' } });
    expect((await relais.fetch(requete('/v1/quota', { jeton: 'inconnu' }), e)).status).toBe(403);
  });

  it('compare les versions champ par champ', () => {
    expect(miseAJourRequise('1.10.0', '1.9.0')).toBe(false);
    expect(miseAJourRequise('1.2', '1.2.0')).toBe(false);
    expect(miseAJourRequise('2.0.0', '1.9.9')).toBe(false);
    expect(miseAJourRequise('1.0.0', '1.0.1')).toBe(true);
    expect(miseAJourRequise('n’importe quoi', '1.0.0')).toBe(true);
    expect(miseAJourRequise(null, '1.0.0')).toBe(true);
    expect(miseAJourRequise(null, undefined)).toBe(false);
    expect(miseAJourRequise('0.1', 'illisible')).toBe(false);
  });
});
