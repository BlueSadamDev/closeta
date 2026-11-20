/**
 * Lecture des données produit d'une page HTML, sans IA.
 * Ordre : 1) données structurées schema.org (JSON-LD « Product »),
 *         2) balises de partage (Open Graph, product:price…),
 *         3) titre de la page et nom du site en dernier recours.
 * Une information introuvable vaut null : rien n'est inventé.
 */

export type Extraction = {
  nom: string | null;
  marque: string | null;
  image: string | null;
  prix: number | null;
  devise: string | null;
  url: string;
};

type Json = null | boolean | number | string | Json[] | { [cle: string]: Json };
type Objet = { [cle: string]: Json };

const estObjet = (v: Json | undefined): v is Objet => typeof v === 'object' && v !== null && !Array.isArray(v);

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '’', nbsp: ' ', '#39': '’' };

/** Remplace les entités HTML (&amp;, &#8211;, &#x27;…) et nettoie les espaces. */
export function texteNet(brut: string | null | undefined): string | null {
  if (brut === null || brut === undefined) return null;
  const decode = brut
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+|#39);/gi, (m, n: string) => ENTITES[n.toLowerCase()] ?? m)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decode === '' ? null : decode;
}

/**
 * Lit un montant écrit de différentes façons : 1290, "1290.00", "1 290,00 €", "1,290.00", "1.290,00".
 * Le dernier séparateur suivi de 1 ou 2 chiffres est la virgule décimale ; les autres séparent les milliers.
 */
export function lireMontant(brut: Json | undefined): number | null {
  if (typeof brut === 'number') return Number.isFinite(brut) && brut >= 0 ? brut : null;
  if (typeof brut !== 'string') return null;
  const s = brut.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;
  const decimale = s.match(/[.,](\d{1,2})$/);
  const entiers = (decimale ? s.slice(0, -decimale[0].length) : s).replace(/[.,]/g, '');
  const n = Number(`${entiers || '0'}.${decimale ? decimale[1] : '0'}`);
  return Number.isFinite(n) ? n : null;
}

// ---------- 1) JSON-LD ----------

function blocsJsonLd(html: string): Json[] {
  const blocs: Json[] = [];
  const motif = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const [, contenu] of html.matchAll(motif)) {
    for (const essai of [contenu, contenu.replace(/[\n\r\t]/g, ' ')]) {
      try {
        blocs.push(JSON.parse(essai) as Json);
        break;
      } catch {
        // bloc mal formé : on essaie la version nettoyée, sinon on l'ignore
      }
    }
  }
  return blocs;
}

const aLeType = (o: Objet, ...types: string[]) => {
  const t = o['@type'];
  const liste = Array.isArray(t) ? t : [t];
  return liste.some((x) => typeof x === 'string' && types.includes(x));
};

/** Cherche le premier objet « Product » (ou « ProductGroup ») dans les blocs, @graph compris. */
function trouverProduit(v: Json | undefined, profondeur = 0): Objet | null {
  if (profondeur > 6 || v === undefined || v === null) return null;
  if (Array.isArray(v)) {
    for (const e of v) {
      const p = trouverProduit(e, profondeur + 1);
      if (p) return p;
    }
    return null;
  }
  if (!estObjet(v)) return null;
  if (aLeType(v, 'Product', 'ProductGroup', 'IndividualProduct', 'ProductModel')) return v;
  for (const cle of ['@graph', 'mainEntity', 'itemListElement', 'item']) {
    const p = trouverProduit(v[cle], profondeur + 1);
    if (p) return p;
  }
  return null;
}

function premierTexte(v: Json | undefined, ...cles: string[]): string | null {
  if (typeof v === 'string') return texteNet(v);
  if (Array.isArray(v)) {
    for (const e of v) {
      const t = premierTexte(e, ...cles);
      if (t) return t;
    }
    return null;
  }
  if (estObjet(v)) {
    for (const c of cles) {
      const t = premierTexte(v[c], ...cles);
      if (t) return t;
    }
  }
  return null;
}

/** Prix et devise d'un produit : offers (objet, liste, AggregateOffer) ou variantes d'un ProductGroup. */
function prixDuProduit(p: Objet): { prix: number | null; devise: string | null } {
  const offres: Json[] = [];
  const ajouter = (v: Json | undefined) => {
    if (Array.isArray(v)) v.forEach((e) => offres.push(e));
    else if (v !== undefined) offres.push(v);
  };
  ajouter(p.offers);
  if (Array.isArray(p.hasVariant)) p.hasVariant.forEach((variante) => estObjet(variante) && ajouter(variante.offers));

  for (const o of offres) {
    if (!estObjet(o)) continue;
    const spec = estObjet(o.priceSpecification) ? o.priceSpecification : Array.isArray(o.priceSpecification) && estObjet(o.priceSpecification[0]) ? o.priceSpecification[0] : null;
    const prix = lireMontant(o.price) ?? lireMontant(o.lowPrice) ?? (spec ? lireMontant(spec.price) : null);
    if (prix !== null) {
      const devise = premierTexte(o.priceCurrency) ?? (spec ? premierTexte(spec.priceCurrency) : null);
      return { prix, devise };
    }
  }
  return { prix: null, devise: null };
}

// ---------- 2) balises meta ----------

function balisesMeta(html: string): Map<string, string> {
  const metas = new Map<string, string>();
  for (const [balise] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributs = new Map<string, string>();
    for (const [, nom, , valeur1, valeur2, valeur3] of balise.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributs.set(nom.toLowerCase(), valeur1 ?? valeur2 ?? valeur3 ?? '');
    }
    const cle = (attributs.get('property') ?? attributs.get('name') ?? attributs.get('itemprop'))?.toLowerCase();
    const contenu = attributs.get('content');
    if (cle && contenu !== undefined && !metas.has(cle)) metas.set(cle, contenu);
  }
  return metas;
}

const premiereMeta = (metas: Map<string, string>, ...cles: string[]) => {
  for (const c of cles) {
    const t = texteNet(metas.get(c));
    if (t) return t;
  }
  return null;
};

/** Rend une adresse d'image absolue (et https) à partir de l'adresse de la page. */
function imageAbsolue(brute: string | null, page: URL): string | null {
  if (!brute) return null;
  try {
    const u = new URL(brute, page);
    if (u.protocol === 'http:') u.protocol = 'https:';
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------- assemblage ----------

export function extraireProduit(html: string, page: URL): Extraction {
  const produit = trouverProduit(blocsJsonLd(html));
  const metas = balisesMeta(html);
  const titre = texteNet(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);

  const nom = (produit ? premierTexte(produit.name) : null) ?? premiereMeta(metas, 'og:title', 'twitter:title') ?? titre;

  const marque =
    (produit ? premierTexte(produit.brand, 'name') ?? premierTexte(produit.manufacturer, 'name') : null) ??
    premiereMeta(metas, 'product:brand', 'og:brand', 'brand', 'og:site_name', 'application-name');

  const image = imageAbsolue(
    (produit ? premierTexte(produit.image, 'url', 'contentUrl') : null) ??
      premiereMeta(metas, 'og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'),
    page,
  );

  let { prix, devise } = produit ? prixDuProduit(produit) : { prix: null, devise: null };
  if (prix === null) {
    prix = lireMontant(metas.get('product:price:amount') ?? metas.get('og:price:amount') ?? metas.get('price'));
    devise = premiereMeta(metas, 'product:price:currency', 'og:price:currency', 'pricecurrency');
  }
  if (prix === null) devise = null;

  return { nom, marque, image, prix, devise: devise ? devise.toUpperCase() : null, url: page.toString() };
}
