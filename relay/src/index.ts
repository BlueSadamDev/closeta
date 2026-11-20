import { extraireProduit } from './extract';
import { settings } from './settings';
import { urlPublique } from './url';

/** Limiteur de débit fourni par Cloudflare (déclaré dans wrangler.toml). */
interface Limiteur {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** Jeton partagé avec l'app : secret Cloudflare, jamais dans le dépôt. */
  RELAY_TOKEN?: string;
  LIMITEUR: Limiteur;
}

export type CodeErreur =
  | 'jeton_absent'
  | 'jeton_refuse'
  | 'limite'
  | 'route_inconnue'
  | 'requete_invalide'
  | 'url_refusee'
  | 'page_illisible';

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

export default {
  async fetch(requete: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(requete.url);
    if (requete.method !== 'POST' || pathname !== '/extract') return erreur('route_inconnue', 404);

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

    // 2) Limite de débit par jeton.
    if (!(await env.LIMITEUR.limit({ key: `jeton:${hex(await empreinte(jeton)).slice(0, 16)}` })).success) {
      return erreur('limite', 429);
    }

    // 3) Adresse demandée : https public uniquement.
    let corps: unknown;
    try {
      corps = await requete.json();
    } catch {
      return erreur('requete_invalide', 400);
    }
    const url = urlPublique((corps as { url?: unknown } | null)?.url);
    if (!url) return erreur('url_refusee', 400);

    // 4) Lecture de la page et extraction. Rien n'est conservé.
    let page: { html: string; url: URL } | null;
    try {
      page = await lirePage(url);
    } catch {
      page = null;
    }
    if (!page) return erreur('page_illisible', 502);

    return json({ ...extraireProduit(page.html, page.url), url: url.toString() });
  },
};
