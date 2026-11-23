/**
 * Recherche en ligne via SerpApi : Google Lens (à partir de la photo) et Google Shopping
 * (à partir de la recherche écrite par l'IA). Un champ introuvable vaut null : rien n'est inventé.
 */
import { lireMontant } from './extract';
import { settings } from './settings';

export type Proposition = {
  nom: string;
  marque: string | null;
  image: string | null;
  prix: number | null;
  devise: string | null;
  boutique: string | null;
  url: string;
  /** Vrai si c'est un article proche (Google Shopping), pas l'article exact. */
  alternative: boolean;
};

const API = 'https://serpapi.com/search.json';

export function adresseLens(cle: string, photo: string): string {
  const p = new URLSearchParams({ engine: 'google_lens', url: photo, hl: settings.langue, country: settings.pays, api_key: cle });
  return `${API}?${p}`;
}

export function adresseShopping(cle: string, recherche: string): string {
  const p = new URLSearchParams({
    engine: 'google_shopping',
    q: recherche,
    gl: settings.pays,
    hl: settings.langue,
    google_domain: `google.${settings.pays}`,
    api_key: cle,
  });
  return `${API}?${p}`;
}

const DEVISES: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', 'CHF': 'CHF' };

/** Devise d'un prix : code à 3 lettres, ou symbole présent dans le texte du prix. */
export function lireDevise(code: unknown, texte: unknown): string | null {
  if (typeof code === 'string') {
    const c = code.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(c)) return c;
    if (DEVISES[code.trim()]) return DEVISES[code.trim()];
  }
  if (typeof texte === 'string') {
    for (const [symbole, iso] of Object.entries(DEVISES)) if (texte.includes(symbole)) return iso;
    const m = texte.match(/\b(EUR|USD|GBP|CHF)\b/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

const texte = (v: unknown, max = 200): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t.slice(0, max);
};

const lienHttps = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

export const siteIgnore = (url: string) => {
  const hote = new URL(url).hostname.toLowerCase();
  // « pinterest. » couvre pinterest.fr, pinterest.com… ; les autres valent pour le site et ses sous-domaines.
  return settings.sitesIgnores.some((s) => (s.endsWith('.') ? hote.includes(s) : hote === s || hote.endsWith(`.${s}`)));
};

const prixPositif = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : lireMontant(typeof v === 'string' ? v : null);
  return n !== null && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

type Brut = Record<string, unknown>;
const liste = (v: unknown): Brut[] => (Array.isArray(v) ? v.filter((x): x is Brut => typeof x === 'object' && x !== null) : []);

/**
 * Correspondances Google Lens qui mènent à une page de boutique (les réseaux sociaux sont écartés).
 * Par défaut, les pièces avec un prix passent devant ; `prixDabord = false` garde l'ordre de Lens (ressemblance).
 */
export function lireLens(reponse: unknown, prixDabord = true): Proposition[] {
  const r = (reponse ?? {}) as Brut;
  const vues = new Set<string>();
  const propositions: Proposition[] = [];
  for (const m of liste(r.visual_matches)) {
    const url = lienHttps(m.link);
    const nom = texte(m.title);
    if (!url || !nom || siteIgnore(url) || vues.has(url)) continue;
    vues.add(url);
    const prix = (m.price ?? {}) as Brut;
    const montant = prixPositif(prix.extracted_value ?? prix.value);
    propositions.push({
      nom,
      marque: null,
      image: lienHttps(m.image) ?? lienHttps(m.thumbnail),
      prix: montant,
      devise: montant === null ? null : lireDevise(prix.currency, prix.value),
      boutique: texte(m.source, 80),
      url,
      alternative: false,
    });
  }
  if (!prixDabord) return propositions;
  return [...propositions.filter((p) => p.prix !== null), ...propositions.filter((p) => p.prix === null)];
}

/** Résultats Google Shopping, tous étiquetés « alternative ». */
export function lireShopping(reponse: unknown): Proposition[] {
  const r = (reponse ?? {}) as Brut;
  const vues = new Set<string>();
  const propositions: Proposition[] = [];
  for (const s of [...liste(r.shopping_results), ...liste(r.inline_shopping_results)]) {
    const url = lienHttps(s.link) ?? lienHttps(s.product_link);
    const nom = texte(s.title);
    if (!url || !nom || vues.has(url)) continue;
    vues.add(url);
    const montant = prixPositif(s.extracted_price ?? s.price);
    propositions.push({
      nom,
      marque: null,
      image: lienHttps(s.thumbnail) ?? lienHttps(s.serpapi_thumbnail),
      prix: montant,
      devise: montant === null ? null : lireDevise(s.currency, s.price),
      boutique: texte(s.source ?? s.seller, 80),
      url,
      alternative: true,
    });
  }
  return propositions;
}

/** Appelle SerpApi avec un délai maximal. Renvoie la réponse lue, ou lève une erreur (réseau, clé, quota). */
export async function appelerSerpApi(adresse: string, delaiMs: number): Promise<unknown> {
  const reponse = await fetch(adresse, { signal: AbortSignal.timeout(delaiMs), headers: { accept: 'application/json' } });
  const corps = (await reponse.json().catch(() => null)) as Brut | null;
  const message = typeof corps?.error === 'string' ? corps.error : '';
  if (!reponse.ok || !corps) throw new Error(`HTTP ${reponse.status} ${message}`.trim());
  // SerpApi répond parfois 200 avec un champ « error » ; « aucun résultat » n'est pas une panne.
  if (message && !/hasn.t returned any results|no results/i.test(message)) throw new Error(message);
  return corps;
}
