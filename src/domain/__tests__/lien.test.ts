import { brouillonDepuisLien, estLienWeb, lireExtraction, lireHistorique, listeFrancaise, nomDuSite, preremplir, trouverLien } from '../lien';

// Données fictives uniquement : boutique.example est un domaine réservé aux exemples.
const LIEN = 'https://www.boutique.example/veste-laine-ecru';
const REPONSE_COMPLETE = {
  nom: 'Veste en laine',
  marque: 'Maison Fictive',
  image: 'https://cdn.boutique.example/veste.jpg',
  prix: 289.9,
  devise: 'EUR',
  url: LIEN,
  disponibilite: 'en_stock',
  dispo_taille: 'epuise',
};
/** La même réponse, une fois lue par l'app. */
const EXTRACTION_COMPLETE = {
  nom: 'Veste en laine',
  marque: 'Maison Fictive',
  image: 'https://cdn.boutique.example/veste.jpg',
  prix: 289.9,
  devise: 'EUR',
  url: LIEN,
  disponibilite: 'en_stock' as const,
  dispoTaille: 'epuise' as const,
  historique: null,
};
const RIEN_DE_PUBLIE = { disponibilite: 'inconnue' as const, dispoTaille: 'inconnue' as const, historique: null };

describe('trouverLien', () => {
  it('lit un lien seul', () => {
    expect(trouverLien(LIEN)).toBe(LIEN);
  });
  it('retrouve le lien dans une phrase partagée par une appli de boutique', () => {
    expect(trouverLien(`Regarde cette veste : ${LIEN} !`)).toBe(LIEN);
    expect(trouverLien(`Veste en laine (${LIEN}).`)).toBe(LIEN);
  });
  it('garde les paramètres du lien', () => {
    expect(trouverLien('https://boutique.example/p?ref=12&taille=M')).toBe('https://boutique.example/p?ref=12&taille=M');
  });
  it('rien de lisible : null', () => {
    expect(trouverLien('Une belle veste')).toBeNull();
    expect(trouverLien('')).toBeNull();
    expect(trouverLien(null)).toBeNull();
    expect(trouverLien('https://localhost')).toBeNull();
  });
});

describe('estLienWeb', () => {
  it('accepte un lien complet', () => {
    expect(estLienWeb(LIEN)).toBe(true);
    expect(estLienWeb('  http://boutique.example  ')).toBe(true);
  });
  it('refuse un lien incomplet ou un autre type d’adresse', () => {
    expect(estLienWeb('boutique.example/veste')).toBe(false);
    expect(estLienWeb('https://boutique')).toBe(false);
    expect(estLienWeb('ftp://boutique.example')).toBe(false);
  });
});

describe('nomDuSite', () => {
  it('affiche le site sans « www. »', () => {
    expect(nomDuSite(LIEN)).toBe('boutique.example');
  });
});

describe('lireExtraction', () => {
  it('réponse complète', () => {
    expect(lireExtraction(200, REPONSE_COMPLETE, LIEN)).toEqual({ ok: true, extraction: EXTRACTION_COMPLETE });
  });
  it('champs absents ou mal formés : null, jamais inventés', () => {
    const r = lireExtraction(
      200,
      { nom: 'Veste', marque: '  ', image: 'http://non-securise.example/a.jpg', prix: -3, disponibilite: 'peut-être' },
      LIEN,
    );
    expect(r).toEqual({
      ok: true,
      extraction: { nom: 'Veste', marque: null, image: null, prix: null, devise: null, url: LIEN, ...RIEN_DE_PUBLIE },
    });
  });
  it('page dont rien n’a été tiré : illisible', () => {
    expect(lireExtraction(200, { nom: null, marque: null, image: null, prix: null, url: LIEN }, LIEN)).toEqual({
      ok: false,
      raison: 'illisible',
    });
  });
  it('refus et pannes du relais', () => {
    expect(lireExtraction(null, null, LIEN)).toEqual({ ok: false, raison: 'injoignable' });
    expect(lireExtraction(401, { erreur: 'jeton_absent' }, LIEN)).toEqual({ ok: false, raison: 'jeton_absent' });
    expect(lireExtraction(403, { erreur: 'jeton_refuse' }, LIEN)).toEqual({ ok: false, raison: 'jeton_refuse' });
    expect(lireExtraction(429, { erreur: 'limite' }, LIEN)).toEqual({ ok: false, raison: 'limite' });
    expect(lireExtraction(502, { erreur: 'page_illisible' }, LIEN)).toEqual({ ok: false, raison: 'illisible' });
    expect(lireExtraction(400, { erreur: 'url_refusee' }, LIEN)).toEqual({ ok: false, raison: 'illisible' });
  });
});

describe('lireHistorique', () => {
  const historique = { prix_min: 79, devise: 'EUR', date_prix_min: '2026-10-20T00:00:00.000Z', observations: 3, depuis: '2026-10-05T00:00:00.000Z' };

  it('lit le prix le plus bas observé en euros', () => {
    expect(lireHistorique(historique)).toEqual({ prixMin: 79, date: '2026-10-20T00:00:00.000Z' });
    expect(lireExtraction(200, { ...EXTRACTION_COMPLETE, historique }, LIEN)).toMatchObject({
      ok: true,
      extraction: { historique: { prixMin: 79 } },
    });
  });

  it('ignore une autre devise, moins de 2 observations, un prix ou une date invalides, une absence', () => {
    expect(lireHistorique({ ...historique, devise: 'USD' })).toBeNull();
    expect(lireHistorique({ ...historique, observations: 1 })).toBeNull();
    expect(lireHistorique({ ...historique, prix_min: 0 })).toBeNull();
    expect(lireHistorique({ ...historique, date_prix_min: 'hier' })).toBeNull();
    expect(lireHistorique(undefined)).toBeNull();
    expect(lireExtraction(200, EXTRACTION_COMPLETE, LIEN)).toMatchObject({ ok: true, extraction: { historique: null } });
  });
});

describe('preremplir', () => {
  it('remplit nom, marque, prix et lien ; rien à compléter', () => {
    const r = preremplir(EXTRACTION_COMPLETE);
    expect(r.brouillon).toMatchObject({ nom: 'Veste en laine', marque: 'Maison Fictive', prix: '289,90', urlBoutique: LIEN });
    expect(r.brouillon.type).toBeNull();
    expect(r.image).toBe(EXTRACTION_COMPLETE.image);
    expect(r.manquants).toEqual([]);
  });
  it('signale ce qui manque', () => {
    const r = preremplir({ nom: 'Veste', marque: null, image: null, prix: null, devise: null, url: LIEN, ...RIEN_DE_PUBLIE });
    expect(r.manquants).toEqual(['marque', 'prix', 'image']);
  });
  it('un prix dans une autre devise n’est pas repris', () => {
    const r = preremplir({ ...EXTRACTION_COMPLETE, devise: 'USD' });
    expect(r.brouillon.prix).toBe('');
    expect(r.manquants).toEqual(['prix']);
  });
});

describe('brouillonDepuisLien', () => {
  it('formulaire vide avec le lien conservé', () => {
    expect(brouillonDepuisLien(LIEN)).toMatchObject({ nom: '', type: null, urlBoutique: LIEN, priorite: 'moyenne' });
  });
});

describe('listeFrancaise', () => {
  it('joint avec des virgules et « et »', () => {
    expect(listeFrancaise([])).toBe('');
    expect(listeFrancaise(['le prix'])).toBe('le prix');
    expect(listeFrancaise(['la marque', 'le prix'])).toBe('la marque et le prix');
    expect(listeFrancaise(['la marque', 'le prix', 'la photo'])).toBe('la marque, le prix et la photo');
  });
});
