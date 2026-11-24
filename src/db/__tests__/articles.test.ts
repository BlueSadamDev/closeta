import { definirDossierPhotos } from '@/domain/cheminPhoto';
import { marquerAchete } from '@/domain/article';
import { articleFictif } from '@/domain/__fixtures__/articles';

import type { RelevePrix } from '@/domain/releve';

import {
  enregistrerArticle,
  lireArticle,
  lireReleves,
  lireVestiaire,
  lireWishlist,
  supprimerArticle,
} from '../articles';
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
    const a = articleFictif({
      id: 'x',
      nom: 'Veste',
      prix: 129.9,
      estAlternative: true,
      marque: null,
      prixAjout: 150,
      disponibilite: 'epuise',
      dispoTaille: 'en_stock',
      dateVerif: '2026-04-01T12:00:00.000Z',
      alternativeDe: 'origine',
    });
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

  it('le Vestiaire ne lit que les articles achetés', async () => {
    const db = await basePrete();
    const a = articleFictif({ id: 'x' });
    await enregistrerArticle(db, a);
    await enregistrerArticle(db, articleFictif({ id: 'y' }));
    await enregistrerArticle(db, articleFictif({ id: 'z', statut: 'abandonne' }));
    await enregistrerArticle(db, marquerAchete(a, new Date('2026-04-01T12:00:00.000Z')));
    expect((await lireVestiaire(db)).map((v) => v.id)).toEqual(['x']);
    expect((await lireWishlist(db)).map((w) => w.id)).toEqual(['y']);
  });

  it('supprime réellement un article', async () => {
    const db = await basePrete();
    await enregistrerArticle(db, articleFictif({ id: 'x' }));
    await supprimerArticle(db, 'x');
    expect(await lireArticle(db, 'x')).toBeNull();
  });

  it('range en base le nom seul de la photo et rend le chemin complet à la lecture', async () => {
    const dossier = 'file:///data/user/0/fr.exemple.closeta/files/images/';
    definirDossierPhotos(dossier);
    try {
      const db = await basePrete();
      await enregistrerArticle(db, articleFictif({ id: 'x', imageLocale: `${dossier}x-1732400000000` }));
      expect(db.brute.prepare("SELECT image_locale FROM article WHERE id = 'x'").get()).toEqual({ image_locale: 'x-1732400000000' });
      expect((await lireArticle(db, 'x'))?.imageLocale).toBe(`${dossier}x-1732400000000`);
    } finally {
      definirDossierPhotos(null);
    }
  });

  it('laisse une trace de la pièce et de chacun de ses relevés supprimés', async () => {
    const db = await basePrete();
    await enregistrerArticle(db, articleFictif({ id: 'x', prix: 100 }), {
      id: 'r1', articleId: 'x', date: '2026-03-01T10:00:00.000Z', prix: 100, devise: 'EUR',
      disponibilite: 'inconnue', dispoTaille: 'inconnue', source: 'ajout',
    });
    await enregistrerArticle(db, articleFictif({ id: 'y' }));
    await supprimerArticle(db, 'x', new Date('2026-04-01T12:00:00.000Z'));
    expect(db.brute.prepare('SELECT id, "table", date FROM suppression ORDER BY "table"').all()).toEqual([
      { id: 'x', table: 'article', date: '2026-04-01T12:00:00.000Z' },
      { id: 'r1', table: 'releve_prix', date: '2026-04-01T12:00:00.000Z' },
    ]);
  });
});

describe('relevés de prix en base', () => {
  const releve = (id: string, date: string, prix: number, source: RelevePrix['source'] = 'manuel'): RelevePrix => ({
    id,
    articleId: 'x',
    date,
    prix,
    devise: 'EUR',
    disponibilite: 'inconnue',
    dispoTaille: 'inconnue',
    source,
  });

  it('enregistre le relevé avec la pièce et relit l’historique du plus récent au plus ancien', async () => {
    const db = await basePrete();
    await enregistrerArticle(db, articleFictif({ id: 'x', prix: 100 }), releve('r1', '2026-03-01T10:00:00.000Z', 100, 'ajout'));
    await enregistrerArticle(db, articleFictif({ id: 'x', prix: 80 }), releve('r2', '2026-04-01T10:00:00.000Z', 80));
    expect((await lireReleves(db, 'x')).map((r) => [r.id, r.prix, r.source])).toEqual([
      ['r2', 80, 'manuel'],
      ['r1', 100, 'ajout'],
    ]);
  });

  it('garde l’historique quand la pièce est modifiée sans relevé', async () => {
    const db = await basePrete();
    await enregistrerArticle(db, articleFictif({ id: 'x', prix: 100 }), releve('r1', '2026-03-01T10:00:00.000Z', 100, 'ajout'));
    await enregistrerArticle(db, articleFictif({ id: 'x', prix: 100, nom: 'Nouveau nom' }));
    expect(await lireReleves(db, 'x')).toHaveLength(1);
  });

  it('supprime l’historique avec la pièce', async () => {
    const db = await basePrete();
    await enregistrerArticle(db, articleFictif({ id: 'x', prix: 100 }), releve('r1', '2026-03-01T10:00:00.000Z', 100, 'ajout'));
    await supprimerArticle(db, 'x');
    expect(await lireReleves(db, 'x')).toEqual([]);
  });
});
