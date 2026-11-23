import { chercherAlternatives, DemandeInvalide, lireDemande } from './alternatives';
import { extraireProduit } from './extract';
import type { IA } from './ia';
import { clePhoto, estJpeg, identifiantValide, identifier, QuotaAtteint, RechercheIndisponible, type Stockage } from './identify';
import { Compteur, lireLimite, type Magasin } from './quota';
import { settings } from './settings';
import { urlPublique } from './url';

/** Limiteur de débit fourni par Cloudflare (déclaré dans wrangler.toml). */
interface Limiteur {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Jeton partagé avec l'app : secret Cloudflare, jamais dans le dépôt. */
  RELAY_TOKEN?: string;
  /** Clé SerpApi (Google Lens et Shopping) : secret Cloudflare, jamais dans le dépôt. */
  SERPAPI_KEY?: string;
  LIMITEUR: Limiteur;
  /** IA de Cloudflare (Workers AI) qui décrit les photos. */
  AI: IA;
  /** Stockage temporaire des photos, le temps de la recherche Google Lens. */
  PHOTOS: Stockage;
  /** Compteur des recherches SerpApi du mois (Cloudflare KV). */
  QUOTA: Magasin;
  /** Seuil mensuel de recherches SerpApi, réglé dans wrangler.toml ([vars]). */
  SERPAPI_LIMITE_MOIS?: string;
}

export type CodeErreur =
  | 'jeton_absent'
  | 'jeton_refuse'
  | 'limite'
  | 'route_inconnue'
  | 'requete_invalide'
  | 'url_refusee'
  | 'page_illisible'
  | 'photo_refusee'
  | 'recherche_indisponible'
  | 'quota_atteint';

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const erreur = (code: CodeErreur, statut: number) => json({ erreur: code }, statut);

async function empreinte(texte: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte)));
}

/** Compare deux jetons en temps constant (on compare leurs empreintes, de même longueur). */
async function jetonsEgaux(a: string, b: string): Promise<boolean> {
  const [ea, eb] = await Promise.all([empreinte(a), empreinte(b)]);
  let difference = 0;
  for (let i = 0; i < ea.length; i++) difference |= ea[i] ^ eb[i];
  return difference === 0;
}

const hex = (octets: Uint8Array) => [...octets].map((o) => o.toString(16).padStart(2, '0')).join('');

/** Lit la page en suivant les redirections, chacune revérifiée (toujours https public). */
async function lirePage(depart: URL): Promise<{ html: string; url: URL } | null> {
  let url = depart;
  const signal = AbortSignal.timeout(settings.delaiPageMs);
  for (let i = 0; i <= settings.redirectionsMax; i++) {
    const reponse = await fetch(url.toString(), {
      redirect: 'manual',
      signal,
      headers: {
        'user-agent': settings.userAgent,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'fr-FR,fr;q=0.9,en;q=0.6',
        // Demande les prix en euros pour la France (boutiques Shopify à plusieurs devises).
        cookie: settings.cookieLocalisation,
      },
    });
    if (reponse.status >= 300 && reponse.status < 400) {
      const suivante = urlPublique(new URL(reponse.headers.get('location') ?? '', url).toString());
      if (!suivante) return null;
      url = suivante;
      continue;
    }
    if (!reponse.ok || !(reponse.headers.get('content-type') ?? '').includes('html') || !reponse.body) return null;
    return { html: await lireAvecLimite(reponse.body), url };
  }
  return null;
}

async function lireAvecLimite(flux: ReadableStream<Uint8Array>): Promise<string> {
  const lecteur = flux.getReader();
  const decodeur = new TextDecoder();
  let html = '';
  let lu = 0;
  while (lu < settings.tailleMaxPage) {
    const { done, value } = await lecteur.read();
    if (done) break;
    lu += value.byteLength;
    html += decodeur.decode(value, { stream: true });
  }
  await lecteur.cancel().catch(() => undefined);
  return html + decodeur.decode();
}

/** Lit la photo envoyée par l'app (JPEG brut), sans dépasser la taille maximale. */
async function lirePhoto(requete: Request): Promise<Uint8Array | null> {
  if (!(requete.headers.get('content-type') ?? '').startsWith('image/jpeg') || !requete.body) return null;
  const annoncee = Number(requete.headers.get('content-length') ?? '0');
  if (annoncee > settings.tailleMaxPhoto) return null;
  const lecteur = requete.body.getReader();
  const morceaux: Uint8Array[] = [];
  let lu = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    lu += value.byteLength;
    if (lu > settings.tailleMaxPhoto) {
      await lecteur.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(value);
  }
  const photo = new Uint8Array(lu);
  let position = 0;
  for (const m of morceaux) {
    photo.set(m, position);
    position += m.byteLength;
  }
  return estJpeg(photo) ? photo : null;
}

/** POST /extract : lecture d'une page produit. */
async function routeExtract(requete: Request): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return erreur('requete_invalide', 400);
  }
  // Adresse demandée : https public uniquement.
  const url = urlPublique((corps as { url?: unknown } | null)?.url);
  if (!url) return erreur('url_refusee', 400);

  // Lecture de la page et extraction. Rien n'est conservé.
  let page: { html: string; url: URL } | null;
  try {
    page = await lirePage(url);
  } catch {
    page = null;
  }
  if (!page) return erreur('page_illisible', 502);

  // Taille de la pièce (facultative), pour lire sa disponibilité.
  const taille = (corps as { taille?: unknown }).taille;
  const tailleLue = typeof taille === 'string' && taille.trim() !== '' ? taille.trim().slice(0, settings.tailleMaxTaille) : null;
  return json({ ...extraireProduit(page.html, page.url, tailleLue), url: url.toString() });
}

const compteur = (env: Env) => new Compteur(env.QUOTA, lireLimite(env.SERPAPI_LIMITE_MOIS));

/** GET /quota : recherches SerpApi du mois, `{ utilise, limite, mois }`. */
async function routeQuota(env: Env): Promise<Response> {
  return json(await compteur(env).etat());
}

/** POST /identify : propositions à partir d'une photo. */
async function routeIdentify(requete: Request, env: Env): Promise<Response> {
  const photo = await lirePhoto(requete);
  if (!photo) return erreur('photo_refusee', 400);
  const quota = compteur(env);
  // Seuil atteint : réponse immédiate, sans IA ni SerpApi.
  if (await quota.atteint()) return erreur('quota_atteint', 429);
  const origine = new URL(requete.url).origin;
  try {
    const resultat = await identifier(photo, {
      ia: env.AI,
      stockage: env.PHOTOS,
      cleSerpApi: env.SERPAPI_KEY,
      quota,
      adressePhoto: (id) => `${origine}/photo/${id}`,
    });
    return json(resultat);
  } catch (e) {
    if (e instanceof QuotaAtteint) return erreur('quota_atteint', 429);
    if (e instanceof RechercheIndisponible) return json({ erreur: 'recherche_indisponible', incidents: e.incidents }, 502);
    throw e;
  }
}

/** POST /alternatives : pièces qui ressemblent à une pièce de la Wishlist. */
async function routeAlternatives(requete: Request, env: Env): Promise<Response> {
  if (Number(requete.headers.get('content-length') ?? '0') > settings.tailleMaxDemandeAlternatives) {
    return erreur('photo_refusee', 400);
  }
  let demande;
  try {
    const brut = await requete.text();
    if (brut.length > settings.tailleMaxDemandeAlternatives) return erreur('photo_refusee', 400);
    demande = lireDemande(JSON.parse(brut));
  } catch (e) {
    return erreur(e instanceof DemandeInvalide ? e.code : 'requete_invalide', 400);
  }
  const quota = compteur(env);
  // Seuil atteint : réponse immédiate, sans appel à SerpApi.
  if (await quota.atteint()) return erreur('quota_atteint', 429);
  const origine = new URL(requete.url).origin;
  try {
    return json(
      await chercherAlternatives(demande, {
        stockage: env.PHOTOS,
        cleSerpApi: env.SERPAPI_KEY,
        quota,
        adressePhoto: (id) => `${origine}/photo/${id}`,
      }),
    );
  } catch (e) {
    if (e instanceof QuotaAtteint) return erreur('quota_atteint', 429);
    if (e instanceof RechercheIndisponible) return json({ erreur: 'recherche_indisponible', incidents: e.incidents }, 502);
    throw e;
  }
}

/**
 * GET /photo/<id> : la photo déposée le temps de la recherche, lue par Google Lens.
 * Sans jeton (Lens ne peut pas en envoyer) : l'identifiant de 64 caractères aléatoires est impossible
 * à deviner, et la photo est supprimée dès la fin de la recherche.
 */
async function routePhoto(id: string, env: Env, requete: Request): Promise<Response> {
  const ip = requete.headers.get('cf-connecting-ip') ?? 'inconnue';
  if (!(await env.LIMITEUR.limit({ key: `ip:${ip}` })).success) return erreur('limite', 429);
  if (!identifiantValide(id)) return erreur('route_inconnue', 404);
  const objet = await env.PHOTOS.get(clePhoto(id));
  if (!objet) return erreur('route_inconnue', 404);
  return new Response(objet.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'no-store' } });
}

export default {
  async fetch(requete: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(requete.url);
    const photo = pathname.match(/^\/photo\/([^/]+)$/);
    if (requete.method === 'GET' && photo) return routePhoto(photo[1], env, requete);
    const route = `${requete.method} ${pathname}`;
    const routes = ['POST /extract', 'POST /identify', 'POST /alternatives', 'GET /quota'];
    if (!routes.includes(route)) {
      return erreur('route_inconnue', 404);
    }

    // 1) Jeton : sans jeton valide, aucune requête n'est traitée.
    const jeton = (requete.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!jeton) {
      const ip = requete.headers.get('cf-connecting-ip') ?? 'inconnue';
      if (!(await env.LIMITEUR.limit({ key: `ip:${ip}` })).success) return erreur('limite', 429);
      return erreur('jeton_absent', 401);
    }
    if (!env.RELAY_TOKEN || !(await jetonsEgaux(jeton, env.RELAY_TOKEN))) {
      const ip = requete.headers.get('cf-connecting-ip') ?? 'inconnue';
      if (!(await env.LIMITEUR.limit({ key: `ip:${ip}` })).success) return erreur('limite', 429);
      return erreur('jeton_refuse', 403);
    }

    // 2) Limite de débit par jeton (commune à toutes les routes).
    if (!(await env.LIMITEUR.limit({ key: `jeton:${hex(await empreinte(jeton)).slice(0, 16)}` })).success) {
      return erreur('limite', 429);
    }

    if (route === 'GET /quota') return routeQuota(env);
    if (route === 'POST /alternatives') return routeAlternatives(requete, env);
    return pathname === '/extract' ? routeExtract(requete) : routeIdentify(requete, env);
  },
};
