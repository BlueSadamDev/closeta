/**
 * Lecture des données produit d'une page HTML, sans IA.
 * Ordre : 1) données structurées schema.org (JSON-LD « Product »),
 *         2) balises de partage (Open Graph, product:price…),
 *         3) titre de la page et nom du site en dernier recours.
 * Une information introuvable vaut null : rien n'est inventé.
 */

/** Disponibilité publiée par la boutique ; `inconnue` si rien n'est publié (jamais devinée). */
export type Disponibilite = 'en_stock' | 'epuise' | 'inconnue';

export type Extraction = {
  nom: string | null;
  marque: string | null;
  image: string | null;
  prix: number | null;
  devise: string | null;
  url: string;
  /** Disponibilité globale (au moins une taille en stock = en stock). */
  disponibilite: Disponibilite;
  /** Disponibilité de la taille demandée, si la boutique publie ses variantes ; sinon `inconnue`. */
  dispo_taille: Disponibilite;
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

// ---------- disponibilité ----------

/**
 * Lit une valeur de disponibilité : schema.org (« https://schema.org/InStock »), balises de partage
 * (« in stock », « instock », « out of stock »), ou booléen WooCommerce (is_in_stock).
 */
export function lireDisponibilite(v: Json | undefined): Disponibilite {
  if (typeof v === 'boolean') return v ? 'en_stock' : 'epuise';
  if (typeof v !== 'string') return 'inconnue';
  const t = v.toLowerCase().replace(/^https?:\/\/schema\.org\//, '').replace(/[\s_-]/g, '');
  if (['instock', 'limitedavailability', 'onlineonly', 'instoreonly', 'available', 'disponible', 'enstock'].includes(t)) return 'en_stock';
  if (['outofstock', 'soldout', 'discontinued', 'oos', 'epuise', 'rupture', 'unavailable', 'indisponible'].includes(t)) return 'epuise';
  return 'inconnue';
}

/** Plusieurs états réunis : une offre en stock suffit ; épuisé seulement si toutes les offres connues le sont. */
export function reunir(etats: Disponibilite[]): Disponibilite {
  if (etats.includes('en_stock')) return 'en_stock';
  return etats.length > 0 && etats.every((e) => e === 'epuise') ? 'epuise' : 'inconnue';
}

/** Taille écrite de façon comparable : « Taille M » → « m », « EU 42 » → « 42 », « 9,5 UK » → « 9.5uk ». */
export function tailleNormalisee(t: string | null | undefined): string | null {
  if (!t) return null;
  const n = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/,/g, '.')
    .replace(/\b(taille|size|pointure|eu|fr)\b/g, '')
    .replace(/\s+/g, '');
  return n === '' ? null : n;
}

/** Vrai si un texte de variante (« Manteau - M / Noir », « M », « 42 ») désigne la taille demandée. */
function nommeLaTaille(texte: string | null, taille: string): boolean {
  if (!texte) return false;
  return texte.split(/[-–—/|,:()]/).some((morceau) => tailleNormalisee(morceau) === taille);
}

type Variante = { textes: (string | null)[]; etat: Disponibilite };

/** Offres d'un produit JSON-LD, avec les textes qui peuvent porter la taille (nom, taille de la variante). */
function variantesJsonLd(p: Objet): Variante[] {
  const variantes: Variante[] = [];
  const offres = (v: Json | undefined): Objet[] => (Array.isArray(v) ? v.filter(estObjet) : estObjet(v) ? [v] : []);
  for (const o of offres(p.offers)) variantes.push({ textes: [premierTexte(o.name), premierTexte(o.size, 'name')], etat: lireDisponibilite(o.availability) });
  if (Array.isArray(p.hasVariant)) {
    for (const v of p.hasVariant) {
      if (!estObjet(v)) continue;
      const textes = [premierTexte(v.size, 'name'), premierTexte(v.name), premierTexte(v.sku)];
      for (const o of offres(v.offers)) variantes.push({ textes, etat: lireDisponibilite(o.availability) });
    }
  }
  return variantes;
}

/** Variantes WooCommerce (attribut data-product_variations) : taille dans les attributs, stock dans is_in_stock. */
function variantesWoo(html: string): Variante[] {
  const brut = html.match(/data-product_variations\s*=\s*"([^"]*)"/i)?.[1];
  if (!brut) return [];
  let liste: Json;
  try {
    liste = JSON.parse(decoderAttribut(brut)) as Json;
  } catch {
    return [];
  }
  if (!Array.isArray(liste)) return [];
  return liste.filter(estObjet).map((v) => {
    const attributs = estObjet(v.attributes) ? v.attributes : {};
    const textes = Object.entries(attributs)
      .filter(([cle]) => /taille|size|pointure/i.test(cle))
      .map(([, valeur]) => (typeof valeur === 'string' ? valeur : null));
    return { textes, etat: lireDisponibilite(v.is_in_stock) };
  });
}

/** Disponibilité globale et de la taille demandée. Rien de publié → `inconnue`. */
function disponibilites(html: string, produit: Objet | null, metas: Map<string, string>, taille: string | null) {
  const variantes = [...(produit ? variantesJsonLd(produit) : []), ...variantesWoo(html)];
  let disponibilite = reunir(variantes.map((v) => v.etat));
  if (disponibilite === 'inconnue') {
    disponibilite = lireDisponibilite(premiereMeta(metas, 'product:availability', 'og:availability', 'availability'));
  }
  if (disponibilite === 'inconnue') {
    // Produit WooCommerce simple : « <p class="stock out-of-stock"> ».
    const stock = html.match(/<p\b[^>]*class\s*=\s*["'][^"']*\bstock\b[^"']*\b(in-stock|out-of-stock)\b/i)?.[1];
    if (stock) disponibilite = stock.toLowerCase() === 'in-stock' ? 'en_stock' : 'epuise';
  }
  const t = tailleNormalisee(taille);
  const dispo_taille: Disponibilite = t
    ? reunir(variantes.filter((v) => v.textes.some((x) => nommeLaTaille(x, t))).map((v) => v.etat))
    : 'inconnue';
  return { disponibilite, dispo_taille };
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

// ---------- 3) WooCommerce (pages sans données structurées de prix) ----------

const decoderAttribut = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/**
 * Prix d'un produit WooCommerce à variantes (attribut data-product_variations).
 * On prend la variante qui correspond aux paramètres du lien (ex. attribute_pa_couleur=vert),
 * sinon le prix commun à toutes les variantes. Si les prix diffèrent sans indication : rien.
 */
function prixVariantesWoo(html: string, page: URL): number | null {
  const brut = html.match(/data-product_variations\s*=\s*"([^"]*)"/i)?.[1];
  if (!brut) return null;
  let variantes: Json;
  try {
    variantes = JSON.parse(decoderAttribut(brut)) as Json;
  } catch {
    return null;
  }
  if (!Array.isArray(variantes)) return null;
  const avecPrix = variantes.filter(estObjet).filter((v) => lireMontant(v.display_price) !== null);
  const demandes = [...page.searchParams].filter(([cle]) => cle.startsWith('attribute_'));
  if (demandes.length > 0) {
    const correspondante = avecPrix.find((v) =>
      demandes.every(([cle, valeur]) => {
        const attributs = estObjet(v.attributes) ? v.attributes : {};
        const a = attributs[cle];
        return a === '' || (typeof a === 'string' && a.toLowerCase() === valeur.toLowerCase());
      }),
    );
    if (correspondante) return lireMontant(correspondante.display_price);
  }
  const prix = [...new Set(avecPrix.map((v) => lireMontant(v.display_price)))];
  return prix.length === 1 ? prix[0] : null;
}

/** Prix affiché dans le bloc principal « p.price » d'une page WooCommerce (un seul montant, ou le prix soldé). */
function prixAfficheWoo(html: string): { prix: number | null; devise: string | null } {
  const bloc = html.match(/<p\b[^>]*class\s*=\s*["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1];
  if (!bloc) return { prix: null, devise: null };
  const zone = bloc.match(/<ins\b[^>]*>([\s\S]*?)<\/ins>/i)?.[1] ?? bloc;
  const montants = [...zone.matchAll(/woocommerce-Price-amount[^>]*>([\s\S]*?)<\/span>\s*(?:<\/bdi>)?/gi)];
  if (montants.length !== 1) return { prix: null, devise: null };
  const texte = texteNet(montants[0][1]) ?? '';
  const prix = lireMontant(texte.replace(/€|EUR|\$|£/g, ''));
  const devise = /€|&euro;|EUR/i.test(montants[0][1]) ? 'EUR' : null;
  return { prix, devise };
}

// ---------- assemblage ----------

/** Valeurs de marque factices laissées par certaines boutiques (ex. Shopify « vendor-unknown »). */
const MARQUE_FACTICE = /^(vendor[-_ ]?unknown|unknown|default|default vendor|n\/?a|none|null|undefined|-)$/i;
const marqueReelle = (m: string | null) => (m && !MARQUE_FACTICE.test(m) ? m : null);

/** Retire « | Boutique », « — Boutique »… en fin de nom quand c'est le nom du site ou de la marque. */
function sansSuffixe(nom: string | null, ...noms: (string | null)[]): string | null {
  if (!nom) return nom;
  const m = nom.match(/^(.*\S)\s+[|–—-]\s+([^|–—]+)$/);
  if (!m) return nom;
  const fin = m[2].trim().toLowerCase();
  return noms.some((n) => n && n.trim().toLowerCase() === fin) ? m[1] : nom;
}

/** `taille` : taille de la pièce (« M », « 42 »), pour lire sa disponibilité si la boutique la publie. */
export function extraireProduit(html: string, page: URL, taille: string | null = null): Extraction {
  const produit = trouverProduit(blocsJsonLd(html));
  const metas = balisesMeta(html);
  const titre = texteNet(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const nomDuSite = premiereMeta(metas, 'og:site_name', 'application-name');

  const marque =
    (produit ? marqueReelle(premierTexte(produit.brand, 'name')) ?? marqueReelle(premierTexte(produit.manufacturer, 'name')) : null) ??
    marqueReelle(premiereMeta(metas, 'product:brand', 'og:brand', 'brand')) ??
    marqueReelle(nomDuSite);

  const nom = sansSuffixe(
    (produit ? premierTexte(produit.name) : null) ?? premiereMeta(metas, 'og:title', 'twitter:title') ?? titre,
    nomDuSite,
    marque,
  );

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
  if (prix === null) {
    prix = prixVariantesWoo(html, page);
    if (prix !== null) devise = premiereMeta(metas, 'product:price:currency', 'og:price:currency', 'pricecurrency') ?? (/&euro;|€/.test(html) ? 'EUR' : null);
  }
  if (prix === null) ({ prix, devise } = prixAfficheWoo(html));
  if (prix === null) devise = null;

  return {
    nom,
    marque,
    image,
    prix,
    devise: devise ? devise.toUpperCase() : null,
    url: page.toString(),
    ...disponibilites(html, produit, metas, taille),
  };
}
