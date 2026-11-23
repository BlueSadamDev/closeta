import { describe, expect, it } from 'vitest';

import { extraireProduit, lireDisponibilite, lireMontant, reunir, tailleNormalisee, texteNet } from '../src/extract';
import opengraphSeul from './fixtures/opengraph-seul.html?raw';
import shopifyVendeurInconnu from './fixtures/shopify-vendeur-inconnu.html?raw';
import shopifyTailles from './fixtures/shopify-tailles.html?raw';
import shopify from './fixtures/shopify.html?raw';
import squarespace from './fixtures/squarespace.html?raw';
import vide from './fixtures/vide.html?raw';
import wooPrixAffiche from './fixtures/woo-prix-affiche.html?raw';
import wooTailles from './fixtures/woo-tailles.html?raw';
import wooVariantes from './fixtures/woo-variantes.html?raw';
import woocommerce from './fixtures/woocommerce.html?raw';

const PAGES: Record<string, string> = {
  shopify,
  woocommerce,
  squarespace,
  'opengraph-seul': opengraphSeul,
  vide,
  'woo-variantes': wooVariantes,
  'woo-prix-affiche': wooPrixAffiche,
  'shopify-vendeur-inconnu': shopifyVendeurInconnu,
  'shopify-tailles': shopifyTailles,
  'woo-tailles': wooTailles,
};
const page = (nom: string) => PAGES[nom];

describe('extraction des données produit (pages fictives)', () => {
  it('lit une page de type Shopify (JSON-LD complet)', () => {
    expect(extraireProduit(page('shopify'), new URL('https://boutique.exemple.test/products/manteau-fictif'))).toEqual({
      nom: 'Manteau fictif en laine',
      marque: 'Maison Exemple',
      image: 'https://cdn.exemple.test/files/manteau.jpg?v=1',
      prix: 1290,
      devise: 'EUR',
      url: 'https://boutique.exemple.test/products/manteau-fictif',
      disponibilite: 'en_stock',
      dispo_taille: 'inconnue',
    });
  });

  it('lit une page de type WooCommerce (@graph, AggregateOffer, entités HTML)', () => {
    expect(extraireProduit(page('woocommerce'), new URL('https://atelier.exemple.test/produit/blouson/'))).toEqual({
      nom: 'Blouson fictif col montant – velours',
      marque: 'Atelier Test',
      image: 'https://atelier.exemple.test/wp-content/uploads/blouson.jpg',
      prix: 890,
      devise: 'EUR',
      url: 'https://atelier.exemple.test/produit/blouson/',
      disponibilite: 'inconnue',
      dispo_taille: 'inconnue',
    });
  });

  it('lit une page de type Squarespace (marque en texte, prix en nombre)', () => {
    expect(extraireProduit(page('squarespace'), new URL('https://tailleur.exemple.test/p/pantalon'))).toMatchObject({
      nom: 'Pantalon fictif en flanelle',
      marque: 'Tailleur Exemple',
      image: 'https://images.exemple.test/pantalon.jpg',
      prix: 245,
      devise: 'EUR',
    });
  });

  it('se rabat sur les balises de partage, et laisse le prix manquant plutôt que de l’inventer', () => {
    expect(extraireProduit(page('opengraph-seul'), new URL('https://exemple.test/costume'))).toEqual({
      nom: 'Costume fictif gris',
      marque: 'Boutique Exemple',
      image: 'https://exemple.test/images/costume.jpg',
      prix: null,
      devise: null,
      url: 'https://exemple.test/costume',
      disponibilite: 'inconnue',
      dispo_taille: 'inconnue',
    });
  });

  it('renvoie tout à null sur une page sans données', () => {
    expect(extraireProduit(page('vide'), new URL('https://exemple.test/rien'))).toEqual({
      nom: null,
      marque: null,
      image: null,
      prix: null,
      devise: null,
      url: 'https://exemple.test/rien',
      disponibilite: 'inconnue',
      dispo_taille: 'inconnue',
    });
  });
});

describe('cas particuliers rencontrés sur de vraies boutiques (pages fictives)', () => {
  it('WooCommerce à variantes : prend le prix de la variante demandée dans le lien, et nettoie le nom', () => {
    expect(
      extraireProduit(page('woo-variantes'), new URL('https://atelier.exemple.test/produit/blouson/?attribute_pa_couleur=vert')),
    ).toMatchObject({ nom: 'Blouson fictif / Velours & laine', marque: 'Atelier Test', prix: 1090, devise: 'EUR' });
  });

  it('WooCommerce à variantes de prix différents, sans variante indiquée : le prix reste à compléter', () => {
    expect(extraireProduit(page('woo-variantes'), new URL('https://atelier.exemple.test/produit/blouson/'))).toMatchObject({
      prix: null,
      devise: null,
    });
  });

  it('WooCommerce sans données structurées : lit le prix affiché (le prix soldé), pas celui des articles liés', () => {
    expect(extraireProduit(page('woo-prix-affiche'), new URL('https://atelier.exemple.test/produit/echarpe/'))).toMatchObject({
      nom: 'Écharpe fictive',
      prix: 120,
      devise: 'EUR',
    });
  });

  it('ignore une marque factice (« vendor-unknown ») et prend le nom du site', () => {
    expect(extraireProduit(page('shopify-vendeur-inconnu'), new URL('https://tailleur.exemple.test/p'))).toMatchObject({
      marque: 'Tailleur Exemple',
      prix: 130,
    });
  });
});

describe('disponibilité (pages fictives)', () => {
  const veste = new URL('https://boutique.exemple.test/products/veste-fictive');

  it('lit les valeurs de disponibilité, sans rien deviner', () => {
    expect(lireDisponibilite('http://schema.org/InStock')).toBe('en_stock');
    expect(lireDisponibilite('https://schema.org/LimitedAvailability')).toBe('en_stock');
    expect(lireDisponibilite('out of stock')).toBe('epuise');
    expect(lireDisponibilite('SoldOut')).toBe('epuise');
    expect(lireDisponibilite(false)).toBe('epuise');
    expect(lireDisponibilite('https://schema.org/PreOrder')).toBe('inconnue');
    expect(lireDisponibilite(undefined)).toBe('inconnue');
  });

  it('réunit les offres : une en stock suffit, épuisé seulement si toutes le sont', () => {
    expect(reunir(['epuise', 'en_stock'])).toBe('en_stock');
    expect(reunir(['epuise', 'epuise'])).toBe('epuise');
    expect(reunir(['epuise', 'inconnue'])).toBe('inconnue');
    expect(reunir([])).toBe('inconnue');
  });

  it('écrit les tailles de façon comparable', () => {
    expect(tailleNormalisee('Taille M')).toBe('m');
    expect(tailleNormalisee('EU 42')).toBe('42');
    expect(tailleNormalisee('9,5 UK')).toBe('9.5uk');
    expect(tailleNormalisee('  ')).toBeNull();
  });

  it('variantes JSON-LD : en stock globalement, taille M épuisée, taille L épuisée (champ size)', () => {
    expect(extraireProduit(page('shopify-tailles'), veste, 'M')).toMatchObject({ disponibilite: 'en_stock', dispo_taille: 'epuise', prix: 420 });
    expect(extraireProduit(page('shopify-tailles'), veste, 'S')).toMatchObject({ dispo_taille: 'en_stock' });
    expect(extraireProduit(page('shopify-tailles'), veste, 'Taille L')).toMatchObject({ dispo_taille: 'epuise' });
  });

  it('taille absente des variantes, ou non demandée : inconnue', () => {
    expect(extraireProduit(page('shopify-tailles'), veste, 'XXL').dispo_taille).toBe('inconnue');
    expect(extraireProduit(page('shopify-tailles'), veste).dispo_taille).toBe('inconnue');
  });

  it('variantes WooCommerce : stock par taille', () => {
    const pull = new URL('https://atelier.exemple.test/produit/pull/');
    expect(extraireProduit(page('woo-tailles'), pull, 's')).toMatchObject({ disponibilite: 'en_stock', dispo_taille: 'epuise' });
    expect(extraireProduit(page('woo-tailles'), pull, 'M').dispo_taille).toBe('en_stock');
  });

  it('balise de partage, ou bloc de stock WooCommerce, quand rien d’autre n’est publié', () => {
    const meta = '<html><head><meta property="product:availability" content="out of stock"></head></html>';
    expect(extraireProduit(meta, veste).disponibilite).toBe('epuise');
    const woo = '<html><body><p class="stock out-of-stock">Rupture de stock</p></body></html>';
    expect(extraireProduit(woo, veste).disponibilite).toBe('epuise');
  });
});

describe('lecture des montants', () => {
  it.each([
    [1290, 1290],
    ['1290.00', 1290],
    ['1 290,00 €', 1290],
    ['1,290.00', 1290],
    ['1.290,00', 1290],
    ['290,5', 290.5],
    ['1,290', 1290],
    ['EUR 89', 89],
  ])('%s → %s', (brut, attendu) => {
    expect(lireMontant(brut)).toBe(attendu);
  });

  it.each(['', 'gratuit', null, -5])('refuse %s', (brut) => {
    expect(lireMontant(brut)).toBeNull();
  });
});

describe('nettoyage du texte', () => {
  it('décode les entités et resserre les espaces', () => {
    expect(texteNet('  Veste &amp; pantalon &#8211; &#x27;laine&#x27;  ')).toBe('Veste & pantalon – \'laine\'');
    expect(texteNet('   ')).toBeNull();
  });
});
