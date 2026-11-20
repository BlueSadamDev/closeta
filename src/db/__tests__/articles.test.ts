import { marquerAchete } from '@/domain/article';
import { articleFictif } from '@/domain/__fixtures__/articles';

import { enregistrerArticle, lireArticle, lireWishlist, supprimerArticle } from '../articles';
import { migrer } from '../migrate';
import { baseDeTest } from '../__fixtures__/baseDeTest';

async function basePrete() {
  const db = baseDeTest();
  await migrer(db);
  return db;
}

describe('articles en base', () => {
  it('relit un article enregistré à l’identique, champs manquants compris', async () => {
    const db = await basePrete();
    const a = articleFictif({ id: 'x', nom: 'Veste', prix: 129.9, estAlternative: true, marque: null });
    await enregistrerArticle(db, a);
    expect(await lireArticle(db, 'x')).toEqual(a);
  });

  it('modifie un article existant sans le dupliquer', async () => {
    const db = await basePrete();
    await enregistrerArticle(db, articleFictif({ id: 'x', nom: 'Avant' }));
    await enregistrerArticle(db, articleFictif({ id: 'x', nom: 'Après' }));
    const wishlist = await lireWishlist(db);
    expect(wishlist.map((a) => a.nom)).toEqual(['Après']);
  });

  it('« Je l’ai acheté » retire l’article de la Wishlist mais le garde en base', async () => {
    const db = await basePrete();
    const a = articleFictif({ id: 'x' });
    await enregistrerArticle(db, a);
    await enregistrerArticle(db, marquerAchete(a, new Date('2026-04-01T12:00:00.000Z')));
    expect(await lireWishlist(db)).toEqual([]);
    expect(await lireArticle(db, 'x')).toMatchObject({ statut: 'achete', dateAchat: '2026-04-01T12:00:00.000Z' });
  });

  it('supprime réellement un article', async () => {
    const db = await basePrete();
    await enregistrerArticle(db, articleFictif({ id: 'x' }));
    await supprimerArticle(db, 'x');
    expect(await lireArticle(db, 'x')).toBeNull();
  });
});
