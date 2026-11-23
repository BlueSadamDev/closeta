import { ALTERNATIVE_SANS_PRIX, DESCRIPTION_FICTIVE, PROPOSITION_EXACTE, REPONSE_IDENTIFY } from '../__fixtures__/identification';
import {
  brouillonDepuisDescription,
  DESCRIPTION_VIDE,
  lireIdentification,
  lireParametresPhoto,
  preremplirDepuisProposition,
  recadrage34,
  reduction,
  seulementDesAlternatives,
  type Proposition,
  type Rectangle,
} from '../photo';
import { BROUILLON_VIDE } from '../validation';

describe('reduction', () => {
  it('ramène le plus grand côté à 1024 px', () => {
    expect(reduction(4000, 3000, 1024)).toEqual({ width: 1024 });
    expect(reduction(3000, 4000, 1024)).toEqual({ height: 1024 });
    expect(reduction(2000, 2000, 1024)).toEqual({ width: 1024 });
  });
  it('ne touche pas une photo déjà petite ou sans dimensions', () => {
    expect(reduction(1024, 768, 1024)).toBeNull();
    expect(reduction(0, 0, 1024)).toBeNull();
  });
});

describe('lireIdentification', () => {
  it('lit les propositions et la description', () => {
    const r = lireIdentification(200, REPONSE_IDENTIFY);
    expect(r).toEqual({
      ok: true,
      description: { type: 'vetement', categorie: 'Veste', couleur: 'marron', marque: 'Maison Fictive' },
      propositions: [PROPOSITION_EXACTE, ALTERNATIVE_SANS_PRIX],
    });
  });

  it('une liste vide est un résultat (rien trouvé), pas un échec', () => {
    expect(lireIdentification(200, { description: null, resultats: [] })).toEqual({
      ok: true,
      description: DESCRIPTION_VIDE,
      propositions: [],
    });
  });

  it('écarte les propositions sans nom ou sans lien https, et les doublons', () => {
    const r = lireIdentification(200, {
      resultats: [
        { ...PROPOSITION_EXACTE, nom: '  ' },
        { ...PROPOSITION_EXACTE, url: 'http://boutique.example/p' },
        PROPOSITION_EXACTE,
        PROPOSITION_EXACTE,
        { ...PROPOSITION_EXACTE, url: 'https://boutique.example/autre', image: 'http://non-securise.example/i.jpg', prix: -3 },
      ],
    });
    expect(r.ok && r.propositions.map((p) => [p.url, p.image, p.prix, p.devise])).toEqual([
      [PROPOSITION_EXACTE.url, PROPOSITION_EXACTE.image, 249, 'EUR'],
      ['https://boutique.example/autre', null, null, null],
    ]);
  });

  it('garde au plus 5 propositions', () => {
    const resultats = Array.from({ length: 7 }, (_, i) => ({ ...PROPOSITION_EXACTE, url: `https://boutique.example/${i}` }));
    const r = lireIdentification(200, { resultats });
    expect(r.ok && r.propositions).toHaveLength(5);
  });

  it('traduit les échecs du relais', () => {
    expect(lireIdentification(null, null)).toEqual({ ok: false, raison: 'injoignable' });
    expect(lireIdentification(401, {})).toEqual({ ok: false, raison: 'jeton_absent' });
    expect(lireIdentification(403, {})).toEqual({ ok: false, raison: 'jeton_refuse' });
    expect(lireIdentification(429, {})).toEqual({ ok: false, raison: 'limite' });
    expect(lireIdentification(429, { erreur: 'limite' })).toEqual({ ok: false, raison: 'limite' });
    expect(lireIdentification(429, { erreur: 'quota_atteint' })).toEqual({ ok: false, raison: 'quota_atteint' });
    expect(lireIdentification(400, { erreur: 'photo_refusee' })).toEqual({ ok: false, raison: 'photo_refusee' });
    expect(lireIdentification(502, { erreur: 'recherche_indisponible' })).toEqual({ ok: false, raison: 'indisponible' });
    expect(lireIdentification(200, 'pas du JSON')).toEqual({ ok: false, raison: 'indisponible' });
  });
});

describe('préparation du formulaire', () => {
  const description = { type: 'vetement', categorie: 'Veste', couleur: 'marron', marque: 'Maison Fictive' } as const;

  it('reprend la proposition choisie et complète avec ce que l’IA a vu', () => {
    const { brouillon, manquants } = preremplirDepuisProposition(PROPOSITION_EXACTE as Proposition, description);
    expect(brouillon).toEqual({
      ...BROUILLON_VIDE,
      nom: 'Veste en velours Maison Fictive',
      marque: 'Maison Fictive',
      type: 'vetement',
      categorie: 'Veste',
      couleur: 'marron',
      prix: '249',
      urlBoutique: 'https://boutique.example/veste-velours',
    });
    expect(manquants).toEqual([]);
  });

  it('ne reporte pas la marque vue sur la photo sur une alternative, et signale le prix manquant', () => {
    const { brouillon, manquants } = preremplirDepuisProposition(ALTERNATIVE_SANS_PRIX as Proposition, description);
    expect(brouillon.marque).toBe('');
    expect(brouillon.prix).toBe('');
    expect(manquants).toEqual(['marque', 'prix']);
  });

  it('ne reprend pas un prix dans une autre devise', () => {
    const p = { ...PROPOSITION_EXACTE, devise: 'USD' } as Proposition;
    expect(preremplirDepuisProposition(p, description).brouillon.prix).toBe('');
  });

  it('sans proposition : formulaire rempli par ce que l’IA a vu', () => {
    expect(brouillonDepuisDescription({ ...description })).toEqual({
      ...BROUILLON_VIDE,
      marque: 'Maison Fictive',
      type: 'vetement',
      categorie: 'Veste',
      couleur: 'marron',
    });
    expect(brouillonDepuisDescription(DESCRIPTION_VIDE)).toEqual(BROUILLON_VIDE);
  });

  it('repère une liste faite seulement d’alternatives', () => {
    expect(seulementDesAlternatives([ALTERNATIVE_SANS_PRIX as Proposition])).toBe(true);
    expect(seulementDesAlternatives([PROPOSITION_EXACTE as Proposition, ALTERNATIVE_SANS_PRIX as Proposition])).toBe(false);
    expect(seulementDesAlternatives([])).toBe(false);
  });
});

// La description fictive complète (avec matière et recherche) se lit sans erreur.
it('ignore les champs de description que l’app n’utilise pas', () => {
  const r = lireIdentification(200, { description: DESCRIPTION_FICTIVE, resultats: [] });
  expect(r.ok && r.description).toEqual({ type: 'vetement', categorie: 'Veste', couleur: 'marron', marque: 'Maison Fictive' });
});

describe('lireParametresPhoto', () => {
  it('relit la description et la proposition transmises au formulaire', () => {
    const r = lireParametresPhoto(JSON.stringify(DESCRIPTION_FICTIVE), JSON.stringify(PROPOSITION_EXACTE));
    expect(r.description.categorie).toBe('Veste');
    expect(r.proposition).toEqual(PROPOSITION_EXACTE);
  });
  it('une donnée absente ou abîmée vaut « rien »', () => {
    expect(lireParametresPhoto(undefined, '{oups')).toEqual({ description: DESCRIPTION_VIDE, proposition: null });
  });
});

describe('recadrage 3:4 du Vestiaire', () => {
  const dansLaPhoto = (r: Rectangle, l: number, h: number) =>
    r.originX >= 0 && r.originY >= 0 && r.originX + r.width <= l && r.originY + r.height <= h;

  it('garde toute une photo déjà en 3:4 portrait', () => {
    expect(recadrage34(3000, 4000)).toEqual({ originX: 0, originY: 0, width: 3000, height: 4000 });
  });

  it('coupe les côtés d’une photo plus large, le haut et le bas d’une photo plus haute, au centre', () => {
    expect(recadrage34(4000, 4000)).toEqual({ originX: 500, originY: 0, width: 3000, height: 4000 });
    expect(recadrage34(3000, 6000)).toEqual({ originX: 0, originY: 1000, width: 3000, height: 4000 });
    expect(recadrage34(4000, 3000)).toEqual({ originX: 875, originY: 0, width: 2250, height: 3000 });
  });

  it('retire la marge du cadre sur chaque bord, en restant au centre', () => {
    expect(recadrage34(3000, 4000, 0.06)).toEqual({ originX: 180, originY: 240, width: 2640, height: 3520 });
  });

  it('reste en 3:4, en pixels entiers et dans la photo, pour des tailles quelconques', () => {
    for (const [l, h] of [[3024, 4032], [1080, 1920], [4000, 3000], [1201, 1599], [7, 9]]) {
      for (const marge of [0, 0.06]) {
        const r = recadrage34(l, h, marge) as Rectangle;
        expect(dansLaPhoto(r, l, h)).toBe(true);
        expect(Number.isInteger(r.width) && Number.isInteger(r.height)).toBe(true);
        expect(Math.abs(r.width / r.height - 3 / 4)).toBeLessThan(0.15);
        if (r.width > 100) expect(Math.abs(r.width / r.height - 3 / 4)).toBeLessThan(0.002);
      }
    }
  });

  it('refuse une taille ou une marge illisible', () => {
    expect(recadrage34(0, 4000)).toBeNull();
    expect(recadrage34(Number.NaN, 4000)).toBeNull();
    expect(recadrage34(3000, 4000, 0.5)).toBeNull();
  });
});
