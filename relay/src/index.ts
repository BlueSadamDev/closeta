import { chercherAlternatives, DemandeInvalide, lireDemande } from './alternatives';
import { adresseCatalogue, type BaseD1, Catalogue } from './catalogue';
import { extraireAvecTailles } from './extract';
import type { IA } from './ia';
import { lireGenre, type Genre } from './genre';
import { clePhoto, estJpeg, identifiantValide, identifier, QuotaAtteint, RechercheIndisponible, type Stockage } from './identify';
import {
  creerInstallation,
  empreinteHex,
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
import { normaliserCode, nouveauCode } from './invitations';
import { type EspaceQuota, lireJuridiction, lireLimite, lireLimiteInstallation, objetQuota, QuotaInstallation } from './quota';
import { settings } from './settings';
import { urlPublique } from './url';
import { lireDepot, lireDerniereRelease, miseAJourRequise, VERSION_INCONNUE, type VersionPubliee } from './version';

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
  /** Limite plus stricte pour l'utilisation d'un code d'invitation (sans jeton) ; à défaut, LIMITEUR. */
  LIMITEUR_INVITATION?: Limiteur;
  /** IA de Cloudflare (Workers AI) qui décrit les photos. */
  AI: IA;
  /** Stockage temporaire des photos, le temps de la recherche Google Lens. */
  PHOTOS: Stockage;
  /** Liste des installations (Cloudflare KV) ; anciens compteurs SerpApi, lus une fois pour la reprise. */
  QUOTA: MagasinListable;
  /** Compteur des recherches SerpApi du mois (Durable Object `Quota`). */
  QUOTAS: EspaceQuota;
  /** Seuil mensuel de recherches SerpApi, réglé dans wrangler.toml ([vars]). */
  SERPAPI_LIMITE_MOIS?: string;
  /** Seuil mensuel par installation (vide : même seuil que le global). */
  SERPAPI_LIMITE_INSTALLATION?: string;
  /** Version minimale de l'app (vide : aucune exigence). */
  VERSION_APP_MIN?: string;
  /** Juridiction des données gardées par le Durable Object (« eu ») ; vide : aucune. */
  JURIDICTION_DONNEES?: string;
  /** Dépôt GitHub dont les releases annoncent les nouvelles versions (« propriétaire/nom ») ; vide : aucune. */
  DEPOT_RELEASES?: string;
  /** Catalogue partagé et anonyme (Cloudflare D1) ; absent = relais sans cache. */
  CATALOGUE?: BaseD1;
}

/** Le Durable Object `Quota` (compteurs et invitations), dans la juridiction demandée s'il y en a une. */
const quotaDe = (env: Env) => objetQuota(env.QUOTAS, lireJuridiction(env.JURIDICTION_DONNEES));

const catalogueDe = (env: Env) => (env.CATALOGUE ? new Catalogue(env.CATALOGUE) : null);

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
  | 'installation_inconnue'
  | 'invitation_invalide';

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

/**
 * POST /extract : lecture d'une page produit. Lue il y a moins de 24 h (par n'importe qui) → réponse
 * depuis le catalogue, sans relire la page ; sinon lecture, puis mise à jour du catalogue.
 */
async function routeExtract(requete: Request, env: Env): Promise<Response> {
  let corps: unknown;
  try {
    corps = await requete.json();
  } catch {
    return erreur('requete_invalide', 400);
  }
  // Adresse demandée : https public uniquement.
  const url = urlPublique((corps as { url?: unknown } | null)?.url);
  if (!url) return erreur('url_refusee', 400);

  // Taille de la pièce (facultative), pour lire sa disponibilité.
  const taille = (corps as { taille?: unknown }).taille;
  const tailleLue = typeof taille === 'string' && taille.trim() !== '' ? taille.trim().slice(0, settings.tailleMaxTaille) : null;

  // Catalogue seulement pour une adresse sans paramètre hors liste blanche (sinon : lecture directe, rien gardé).
  const canonique = adresseCatalogue(url);
  const catalogue = canonique ? catalogueDe(env) : null;
  const enCache = canonique ? await catalogue?.produitRecent(canonique, tailleLue) : null;
  if (enCache) return json({ ...enCache, url: url.toString(), depuis_cache: true });

  // Lecture de la page et extraction.
  let page: { html: string; url: URL } | null;
  try {
    page = await lirePage(url);
  } catch {
    page = null;
  }
  if (!page) return erreur('page_illisible', 502);

  const { extraction, dispoTailles } = extraireAvecTailles(page.html, page.url, tailleLue);
  if (canonique) await catalogue?.enregistrerLecture(canonique, extraction, dispoTailles);
  return json({ ...extraction, url: url.toString(), depuis_cache: false });
}

/** Compteur global et compteur de l'installation (chaque recherche compte dans les deux). */
function compteur(env: Env, installation: Installation): QuotaInstallation {
  const global = lireLimite(env.SERPAPI_LIMITE_MOIS);
  const propre = lireLimiteInstallation(env.SERPAPI_LIMITE_INSTALLATION, global);
  return new QuotaInstallation(quotaDe(env), installation.id, { global, installation: propre });
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
  const catalogue = catalogueDe(env);
  // Seuil atteint et pas de catalogue : réponse immédiate, sans IA ni SerpApi
  // (avec le catalogue, une recherche déjà faite reste servie, sans compter).
  if (!catalogue && (await quota.atteint())) return erreur('quota_atteint', 429);
  let genre: Genre | null;
  try {
    genre = lireGenre(new URL(requete.url).searchParams.get('genre'));
  } catch {
    return erreur('requete_invalide', 400);
  }
  const origine = new URL(requete.url).origin;
  try {
    const resultat = await identifier(photo, {
      genre,
      ia: env.AI,
      stockage: env.PHOTOS,
      cleSerpApi: env.SERPAPI_KEY,
      quota,
      adressePhoto: (id) => `${origine}/photo/${id}`,
      catalogue,
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
  const catalogue = catalogueDe(env);
  // Seuil atteint et pas de catalogue : réponse immédiate, sans appel à SerpApi
  // (avec le catalogue, une recherche déjà faite reste servie, sans compter).
  if (!catalogue && (await quota.atteint())) return erreur('quota_atteint', 429);
  const origine = new URL(requete.url).origin;
  try {
    return json(
      await chercherAlternatives(demande, {
        stockage: env.PHOTOS,
        cleSerpApi: env.SERPAPI_KEY,
        quota,
        adressePhoto: (id) => `${origine}/photo/${id}`,
        catalogue,
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

/** Routes /v1/admin/… : réservées au jeton d'administration. */
async function routeAdmin(requete: Request, env: Env, ressource: string, id: string | null): Promise<Response> {
  const jeton = jetonRecu(requete);
  if (!jeton || !env.ADMIN_TOKEN || !(await jetonsEgaux(jeton, env.ADMIN_TOKEN))) {
    if (!(await limiteParAdresse(requete, env))) return erreur('limite', 429);
    return jeton ? erreur('jeton_refuse', 403) : erreur('jeton_absent', 401);
  }
  if (!(await env.LIMITEUR.limit({ key: 'admin' })).success) return erreur('limite', 429);
  return ressource === 'invitations' ? adminInvitations(requete, env, id) : adminInstallations(requete, env, id);
}

/** Corps JSON d'une demande, ou undefined s'il est illisible. */
async function corpsJson(requete: Request): Promise<unknown> {
  try {
    return await requete.json();
  } catch {
    return undefined;
  }
}

/**
 * /v1/admin/invitations : création (POST, le code n'est renvoyé qu'ici, une seule fois), liste des
 * invitations en attente (GET), annulation (DELETE /<id>). Seule l'empreinte du code est gardée.
 */
async function adminInvitations(requete: Request, env: Env, id: string | null): Promise<Response> {
  const objet = quotaDe(env);
  if (requete.method === 'GET' && id === null) return json({ invitations: await objet.listerInvitations() });
  if (requete.method === 'POST' && id === null) {
    const nom = lireNom(await corpsJson(requete));
    if (!nom) return erreur('requete_invalide', 400);
    const code = nouveauCode();
    const invitation = await objet.creerInvitation(await empreinteHex(normaliserCode(code) as string), nom);
    return json({ invitation, code }, 201);
  }
  if (requete.method === 'DELETE' && id !== null) {
    return (await objet.annulerInvitation(id)) ? json({ annulee: true }) : erreur('invitation_invalide', 404);
  }
  return erreur('route_inconnue', 404);
}

/**
 * POST /v1/invitations/utiliser `{ code }`, sans jeton : crée l'installation prévue et renvoie son jeton,
 * une seule fois. Le code est effacé dans la même opération que sa vérification. Un code inconnu, déjà
 * utilisé, annulé ou expiré reçoit la même réponse. Limite de débit stricte, par adresse.
 */
async function routeUtiliserInvitation(requete: Request, env: Env): Promise<Response> {
  const ip = requete.headers.get('cf-connecting-ip') ?? 'inconnue';
  const limiteur = env.LIMITEUR_INVITATION ?? env.LIMITEUR;
  if (!(await limiteur.limit({ key: `invitation:${ip}` })).success) return erreur('limite', 429);
  const corps = await corpsJson(requete);
  const code = normaliserCode(corps && typeof corps === 'object' ? (corps as { code?: unknown }).code : undefined);
  if (!code) return erreur('requete_invalide', 400);
  const prevue = await quotaDe(env).utiliserInvitation(await empreinteHex(code));
  if (!prevue) return erreur('invitation_invalide', 404);
  return json(await creerInstallation(prevue.nom, env.QUOTA), 201);
}

/** /v1/admin/installations : liste (GET), création (POST), révocation (DELETE /<id>). */
async function adminInstallations(requete: Request, env: Env, id: string | null): Promise<Response> {
  if (requete.method === 'GET' && id === null) {
    const installations = [PRINCIPALE, ...(await listerInstallations(env.QUOTA))];
    const { mois, utilises } = await quotaDe(env).utilises(installations.map((i) => i.id));
    return json({ installations: installations.map((i) => ({ ...i, utilise: utilises[i.id] ?? 0 })), mois });
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

/**
 * GET /v1/version : dernière version publiée en release GitHub (`{ derniere, url }`), gardée 1 h dans KV.
 * GitHub indisponible : `{ derniere: null, url: null }`, rien n'est gardé (l'app n'affiche alors rien).
 */
async function routeVersion(env: Env): Promise<Response> {
  const depot = lireDepot(env.DEPOT_RELEASES);
  if (!depot) return json(VERSION_INCONNUE);
  const cle = `version:${depot}`;
  const gardee = await env.QUOTA.get(cle);
  if (gardee) {
    try {
      return json(JSON.parse(gardee) as VersionPubliee);
    } catch {
      // Valeur illisible : relue sur GitHub.
    }
  }
  const lue = await lireDerniereRelease(depot, (adresse, options) => fetch(adresse, options));
  if (!lue) return json(VERSION_INCONNUE);
  await env.QUOTA.put(cle, JSON.stringify(lue), { expirationTtl: settings.dureeVersionS });
  return json(lue);
}

/** Routes de l'app ; servies sous /v1/…, les adresses sans préfixe restent des alias pour les anciens APK. */
const ROUTES_APP = ['POST /extract', 'POST /identify', 'POST /alternatives', 'GET /quota', 'GET /version'];

/** Durable Object du compteur SerpApi : la classe doit être exportée par le Worker. */
export { Quota } from './quotaObjet';

export default {
  async fetch(requete: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(requete.url);
    const photo = pathname.match(/^(?:\/v1)?\/photo\/([^/]+)$/);
    if (requete.method === 'GET' && photo) return routePhoto(photo[1], env, requete);

    const admin = pathname.match(/^\/v1\/admin\/(installations|invitations)(?:\/([^/]+))?$/);
    if (admin) return routeAdmin(requete, env, admin[1], admin[2] ?? null);

    if (requete.method === 'POST' && pathname === '/v1/invitations/utiliser') return routeUtiliserInvitation(requete, env);

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
    if (chemin === '/version') return routeVersion(env);
    if (chemin === '/alternatives') return routeAlternatives(requete, env, installation);
    if (chemin === '/identify') return routeIdentify(requete, env, installation);
    return routeExtract(requete, env);
  },

  /** Tâche planifiée (wrangler.toml, [triggers], chaque nuit à 3 h UTC) : purge des recherches expirées. */
  async scheduled(_evenement: unknown, env: Env): Promise<void> {
    await catalogueDe(env)?.purger();
  },
};
