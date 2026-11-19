import { texts } from '../index';
import { listerTextes, problemesDeTexte } from '../textGuard';

describe('textGuard : les textes de l’app respectent la charte', () => {
  const tous = listerTextes(texts);

  it('trouve au moins un texte à vérifier', () => {
    expect(tous.length).toBeGreaterThan(0);
  });

  it.each(tous.map((t) => [t.chemin, t.texte]))('%s', (_chemin, texte) => {
    expect(problemesDeTexte(texte)).toEqual([]);
  });
});

describe('textGuard : le contrôle repère bien les écarts', () => {
  it.each([
    ['Erreur 403 : token invalide', 'mot à abandonner : « erreur »'],
    ['Ajoute un item', 'mot à abandonner : « item »'],
    ['3 pièce(s)', 'faux pluriel « (s) » : écrire le vrai pluriel'],
    ["Complète l'article", 'apostrophe droite : utiliser ’'],
    ['On lit la page...', 'trois points : utiliser …'],
    ['Prêt ?', 'espace insécable manquante avant « ? »'],
    ['*Un* et *deux*', 'un seul élément en relief par message'],
    ['Relief *ouvert', 'relief mal fermé : astérisque seule'],
    ['Prix inconnu', 'mot à abandonner : « inconnu »'],
  ])('« %s » est refusé', (texte, probleme) => {
    expect(problemesDeTexte(texte)).toContain(probleme);
  });

  it('accepte un texte conforme', () => {
    expect(problemesDeTexte('Le relais ne te reconnaît pas. *Vérifie ton jeton* dans les Réglages.')).toEqual([]);
    expect(problemesDeTexte('Prêt ? Complète le prix !')).toEqual([]);
  });
});
