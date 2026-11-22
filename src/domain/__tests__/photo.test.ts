import { ALTERNATIVE_SANS_PRIX, DESCRIPTION_FICTIVE, PROPOSITION_EXACTE, REPONSE_IDENTIFY } from '../__fixtures__/identification';
import {
  brouillonDepuisDescription,
  DESCRIPTION_VIDE,
  lireIdentification,
  lireParametresPhoto,
  preremplirDepuisProposition,
  reduction,
  seulementDesAlternatives,
  type Proposition,
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
