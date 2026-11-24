import { chercherAlternatives, DemandeInvalide, lireDemande } from './alternatives';
import { extraireProduit } from './extract';
import type { IA } from './ia';
import { clePhoto, estJpeg, identifiantValide, identifier, QuotaAtteint, RechercheIndisponible, type Stockage } from './identify';
import {
  creerInstallation,
  identifiantInstallationValide,
  installationDuJeton,
  type Installation,
  jetonsEgaux,
  lireNom,
  listerInstallations,
  type MagasinListable,
  PRINCIPALE,
  revoquerInstallation,
} from './installations';
import { Compteur, lireLimite, lireLimiteInstallation, QuotaInstallation } from './quota';
import { settings } from './settings';
import { urlPublique } from './url';
import { miseAJourRequise } from './version';

/** Limiteur de débit fourni par Cloudflare (déclaré dans wrangler.toml). */
interface Limiteur {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Ancien jeton partagé (installation « Principale ») : secret Cloudflare, jamais dans le dépôt. */
  RELAY_TOKEN?: string;
  /** Jeton d'administration (routes /v1/admin/…) : secret Cloudflare, jamais dans le dépôt. */
  ADMIN_TOKEN?: string;
  /** Clé SerpApi (Google Lens et Shopping) : secret Cloudflare, jamais dans le dépôt. */
  SERPAPI_KEY?: string;
  LIMITEUR: Limiteur;
  /** IA de Cloudflare (Workers AI) qui décrit les photos. */
  AI: IA;
  /** Stockage temporaire des photos, le temps de la recherche Google Lens. */
  PHOTOS: Stockage;
  /** Compteur des recherches SerpApi du mois et liste des installations (Cloudflare KV). */
  QUOTA: MagasinListable;
  /** Seuil mensuel de recherches SerpApi, réglé dans wrangler.toml ([vars]). */
  SERPAPI_LIMITE_MOIS?: string;
  /** Seuil mensuel par installation (vide : même seuil que le global). */
  SERPAPI_LIMITE_INSTALLATION?: string;
  /** Version minimale de l'app (vide : aucune exigence). */
  VERSION_APP_MIN?: string;
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
  | 'quota_atteint'
  | 'mise_a_jour_requise'
  | 'installation_inconnue';

const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const erreur = (code: CodeErreur, statut: number) => json({ erreur: code }, statut);

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

/** Compteur global et compteur de l'installation (chaque recherche compte dans les deux). */
function compteur(env: Env, installation: Installation): QuotaInstallation {
  const global = lireLimite(env.SERPAPI_LIMITE_MOIS);
  const propre = lireLimiteInstallation(env.SERPAPI_LIMITE_INSTALLATION, global);
  return new QuotaInstallation(
    new Compteur(env.QUOTA, global),
    new Compteur(env.QUOTA, propre, undefined, installation.id),
  );
}

/** GET /quota : recherches SerpApi du mois, `{ installation: { utilise, limite }, global: { utilise, limite }, mois }`. */
async function routeQuota(env: Env, installation: Installation): Promise<Response> {
  return json(await compteur(env, installation).etat());
}

/** POST /identify : propositions à partir d'une photo. */
async function routeIdentify(requete: Request, env: Env, installation: Installation): Promise<Response> {
  const photo = await lirePhoto(requete);
  if (!photo) return erreur('photo_refusee', 400);
  const quota = compteur(env, installation);
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
async function routeAlternatives(requete: Request, env: Env, installation: Installation): Promise<Response> {
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
  const quota = compteur(env, installation);
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

const jetonRecu = (requete: Request) => (requete.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

/** Limite de débit sur l'adresse de l'appelant (requêtes sans jeton valide). */
async function limiteParAdresse(requete: Request, env: Env): Promise<boolean> {
  const ip = requete.headers.get('cf-connecting-ip') ?? 'inconnue';
  return (await env.LIMITEUR.limit({ key: `ip:${ip}` })).success;
}

/** Routes /v1/admin/installations : réservées au jeton d'administration. */
async function routeAdmin(requete: Request, env: Env, id: string | null): Promise<Response> {
  const jeton = jetonRecu(requete);
  if (!jeton || !env.ADMIN_TOKEN || !(await jetonsEgaux(jeton, env.ADMIN_TOKEN))) {
    if (!(await limiteParAdresse(requete, env))) return erreur('limite', 429);
    return jeton ? erreur('jeton_refuse', 403) : erreur('jeton_absent', 401);
  }
  if (!(await env.LIMITEUR.limit({ key: 'admin' })).success) return erreur('limite', 429);

  if (requete.method === 'GET' && id === null) {
    const installations = [PRINCIPALE, ...(await listerInstallations(env.QUOTA))];
    const mois = (await compteur(env, PRINCIPALE).etat()).mois;
    return json({
      installations: await Promise.all(
        installations.map(async (i) => ({ ...i, utilise: (await compteur(env, i).etat()).installation.utilise })),
      ),
      mois,
    });
  }
  if (requete.method === 'POST' && id === null) {
    let corps: unknown;
    try {
      corps = await requete.json();
    } catch {
      return erreur('requete_invalide', 400);
    }
    const nom = lireNom(corps);
    if (!nom) return erreur('requete_invalide', 400);
    // Le jeton n'est renvoyé qu'ici, une seule fois.
    return json(await creerInstallation(nom, env.QUOTA), 201);
  }
  if (requete.method === 'DELETE' && id !== null) {
    if (id === PRINCIPALE.id) return erreur('requete_invalide', 400);
    const revoquee = await revoquerInstallation(id, env.QUOTA);
    return revoquee ? json({ installation: revoquee }) : erreur('installation_inconnue', 404);
  }
  return erreur('route_inconnue', 404);
}

/** Routes de l'app ; servies sous /v1/…, les adresses sans préfixe restent des alias pour les anciens APK. */
const ROUTES_APP = ['POST /extract', 'POST /identify', 'POST /alternatives', 'GET /quota'];

export default {
  async fetch(requete: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(requete.url);
    const photo = pathname.match(/^(?:\/v1)?\/photo\/([^/]+)$/);
    if (requete.method === 'GET' && photo) return routePhoto(photo[1], env, requete);

    const admin = pathname.match(/^\/v1\/admin\/installations(?:\/([^/]+))?$/);
    if (admin) return routeAdmin(requete, env, admin[1] ?? null);

    const chemin = pathname.startsWith('/v1/') ? pathname.slice(3) : pathname;
    const route = `${requete.method} ${chemin}`;
    if (!ROUTES_APP.includes(route)) return erreur('route_inconnue', 404);

    // 1) Jeton : sans jeton valide (inconnu ou révoqué), aucune requête n'est traitée.
    const jeton = jetonRecu(requete);
    if (!jeton) {
      if (!(await limiteParAdresse(requete, env))) return erreur('limite', 429);
      return erreur('jeton_absent', 401);
    }
    const installation = await installationDuJeton(jeton, env.QUOTA, env.RELAY_TOKEN);
    if (!installation) {
      if (!(await limiteParAdresse(requete, env))) return erreur('limite', 429);
      return erreur('jeton_refuse', 403);
    }

    // 2) Limite de débit par installation (commune à toutes les routes).
    if (!(await env.LIMITEUR.limit({ key: `installation:${installation.id}` })).success) {
      return erreur('limite', 429);
    }

    // 3) Identifiant d'installation envoyé par l'app : facultatif (anciens APK), mais bien formé.
    const identifiant = requete.headers.get('x-closeta-installation');
    if (identifiant !== null && !identifiantInstallationValide(identifiant)) return erreur('requete_invalide', 400);

    // 4) Version de l'app : trop ancienne → mise à jour requise.
    if (miseAJourRequise(requete.headers.get('x-closeta-version'), env.VERSION_APP_MIN)) {
      return erreur('mise_a_jour_requise', 426);
    }

    if (chemin === '/quota') return routeQuota(env, installation);
    if (chemin === '/alternatives') return routeAlternatives(requete, env, installation);
    if (chemin === '/identify') return routeIdentify(requete, env, installation);
    return routeExtract(requete);
  },
};
