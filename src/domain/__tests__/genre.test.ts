import { demandeAlternatives } from '../alternatives';
import { genrePourRelais, lireGenreRecherche } from '../genre';
import { articleFictif } from '../__fixtures__/articles';

const ARTICLE_FICTIF = articleFictif({ id: 'fictif-genre', nom: 'Veste en laine' });

describe('genre des recherches', () => {
  it('lit la valeur rangée ; absente ou inconnue = mixte', () => {
    expect(lireGenreRecherche('femme')).toBe('femme');
    expect(lireGenreRecherche('homme')).toBe('homme');
    expect(lireGenreRecherche('mixte')).toBe('mixte');
    expect(lireGenreRecherche(null)).toBe('mixte');
    expect(lireGenreRecherche('Femme')).toBe('mixte');
  });

  it('n’envoie rien au relais pour mixte', () => {
    expect(genrePourRelais('femme')).toBe('femme');
    expect(genrePourRelais('homme')).toBe('homme');
    expect(genrePourRelais('mixte')).toBeNull();
  });

  it('ajoute le genre à la demande d’alternatives, sauf en mixte', () => {
    expect(demandeAlternatives(ARTICLE_FICTIF, null, 'femme').genre).toBe('femme');
    expect('genre' in demandeAlternatives(ARTICLE_FICTIF, null, 'mixte')).toBe(false);
    expect('genre' in demandeAlternatives(ARTICLE_FICTIF, null)).toBe(false);
  });
});
