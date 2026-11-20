import { describe, expect, it } from 'vitest';

import { extraireProduit, lireMontant, texteNet } from '../src/extract';
import opengraphSeul from './fixtures/opengraph-seul.html?raw';
import shopify from './fixtures/shopify.html?raw';
import squarespace from './fixtures/squarespace.html?raw';
import vide from './fixtures/vide.html?raw';
import woocommerce from './fixtures/woocommerce.html?raw';

const PAGES: Record<string, string> = { shopify, woocommerce, squarespace, 'opengraph-seul': opengraphSeul, vide };
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
    });
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
