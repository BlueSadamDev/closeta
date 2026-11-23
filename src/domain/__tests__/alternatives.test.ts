import { articleFictif } from '../__fixtures__/articles';
import {
  demandeAlternatives,
  ecartPrix,
  imagePourRecherche,
  lireAlternatives,
  lireParametreAlternative,
  preremplirDepuisAlternative,
  type Alternative,
} from '../alternatives';

/** Pièce fictive de la Wishlist et alternatives fictives. */
const PIECE = articleFictif({
  id: 'origine',
  nom: 'Veste en laine',
  marque: 'Maison Fictive',
  categorie: 'Veste',
  couleur: 'Écru',
  prix: 420,
  urlBoutique: 'https://boutique.exemple.test/veste',
  imageSource: 'https://images.exemple.test/veste.jpg',
  imageLocale: 'file:///images/origine',
});

const ALTERNATIVE: Alternative = {
  nom: 'Veste laine écrue',
  marque: null,
  image: 'https://images.exemple.test/alt.jpg',
  prix: 390,
  devise: 'EUR',
  boutique: 'Atelier Exemple',
  url: 'https://atelier.exemple.test/veste',
};

describe('image de la recherche', () => {
  it('préfère l’image de la boutique, puis la photo du téléphone', () => {
    expect(imagePourRecherche(PIECE)).toEqual({ url: 'https://images.exemple.test/veste.jpg' });
    expect(imagePourRecherche({ imageSource: null, imageLocale: 'file:///a' })).toEqual({ fichier: 'file:///a' });
    expect(imagePourRecherche({ imageSource: 'http://non-securise.test/a.jpg', imageLocale: null })).toBeNull();
  });

  it('n’envoie la photo que sans image de boutique', () => {
    expect(demandeAlternatives(PIECE, 'BASE64')).toEqual({
      image_url: 'https://images.exemple.test/veste.jpg',
      nom: 'Veste en laine',
      marque: 'Maison Fictive',
      categorie: 'Veste',
      couleur: 'Écru',
      url_exclue: 'https://boutique.exemple.test/veste',
    });
    expect(demandeAlternatives({ ...PIECE, imageSource: null }, 'BASE64')).toMatchObject({ photo: 'BASE64' });
    expect(demandeAlternatives({ ...PIECE, imageSource: null }, 'BASE64')).not.toHaveProperty('image_url');
  });
});

describe('lireAlternatives', () => {
  it('lit les alternatives, sans doublon, au plus 5', () => {
    const resultats = [ALTERNATIVE, ALTERNATIVE, ...[1, 2, 3, 4, 5].map((n) => ({ ...ALTERNATIVE, url: `https://a${n}.test/` }))];
    const r = lireAlternatives(200, { resultats });
    expect(r.ok && r.alternatives).toHaveLength(5);
    expect(r.ok && r.alternatives[0]).toEqual(ALTERNATIVE);
  });

  it('écarte un résultat sans nom ou sans lien https', () => {
    const r = lireAlternatives(200, { resultats: [{ ...ALTERNATIVE, nom: '' }, { ...ALTERNATIVE, url: 'http://a.test/' }] });
    expect(r).toEqual({ ok: true, alternatives: [] });
  });

  it('traduit les échecs du relais', () => {
    expect(lireAlternatives(null, null)).toEqual({ ok: false, raison: 'injoignable' });
    expect(lireAlternatives(401, null)).toEqual({ ok: false, raison: 'jeton_absent' });
    expect(lireAlternatives(403, null)).toEqual({ ok: false, raison: 'jeton_refuse' });
    expect(lireAlternatives(429, { erreur: 'quota_atteint' })).toEqual({ ok: false, raison: 'quota_atteint' });
    expect(lireAlternatives(429, { erreur: 'limite' })).toEqual({ ok: false, raison: 'limite' });
    expect(lireAlternatives(400, { erreur: 'photo_refusee' })).toEqual({ ok: false, raison: 'photo_refusee' });
    expect(lireAlternatives(502, { erreur: 'recherche_indisponible' })).toEqual({ ok: false, raison: 'indisponible' });
  });
});

describe('ecartPrix', () => {
  it('donne l’écart en euros, au centime près', () => {
    expect(ecartPrix(420, ALTERNATIVE)).toEqual({ sens: 'moins', euros: 30 });
    expect(ecartPrix(129.9, { prix: 141.9, devise: 'EUR' })).toEqual({ sens: 'plus', euros: 12 });
    expect(ecartPrix(99.99, { prix: 99.99, devise: null })).toEqual({ sens: 'egal', euros: 0 });
  });

  it('ne devine rien quand un prix manque ou n’est pas en euros', () => {
    expect(ecartPrix(null, ALTERNATIVE)).toBeNull();
    expect(ecartPrix(420, { prix: null, devise: null })).toBeNull();
    expect(ecartPrix(420, { prix: 300, devise: 'USD' })).toBeNull();
  });
});

describe('preremplirDepuisAlternative', () => {
  it('reprend l’alternative, et le type et la catégorie de la pièce d’origine', () => {
    const { brouillon, manquants } = preremplirDepuisAlternative(ALTERNATIVE, PIECE);
    expect(brouillon).toMatchObject({
      nom: 'Veste laine écrue',
      marque: '',
      type: 'vetement',
      categorie: 'Veste',
      couleur: '',
      prix: '390',
      urlBoutique: 'https://atelier.exemple.test/veste',
    });
    expect(manquants).toEqual(['marque']);
  });

  it('laisse le prix à compléter s’il n’est pas en euros', () => {
    const { brouillon, manquants } = preremplirDepuisAlternative({ ...ALTERNATIVE, devise: 'GBP', image: null }, PIECE);
    expect(brouillon.prix).toBe('');
    expect(manquants).toEqual(['marque', 'prix', 'image']);
  });

  it('relit l’alternative transmise au formulaire, et ignore une donnée abîmée', () => {
    expect(lireParametreAlternative(JSON.stringify(ALTERNATIVE))).toEqual(ALTERNATIVE);
    expect(lireParametreAlternative('{oups')).toBeNull();
    expect(lireParametreAlternative(undefined)).toBeNull();
  });
});
