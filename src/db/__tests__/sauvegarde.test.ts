import { definirDossierPhotos } from '@/domain/cheminPhoto';
import { articleFictif } from '@/domain/__fixtures__/articles';
import type { RelevePrix } from '@/domain/releve';
import { construireSauvegarde, ecrireSauvegarde, lireSauvegarde } from '@/domain/sauvegarde';

import { enregistrerArticle, lireArticle, supprimerArticle } from '../articles';
import { migrer } from '../migrate';
import { lireTout, remplacerTout } from '../sauvegarde';
import { baseDeTest } from '../__fixtures__/baseDeTest';

// Deux téléphones fictifs (ou l'APK de développement et celui de production) : dossiers différents.
const DOSSIER_A = 'file:///data/user/0/fr.exemple.closeta/files/images/';
const DOSSIER_B = 'file:///data/user/0/fr.exemple.closeta.dev/files/images/';

const releve: RelevePrix = {
  id: 'r1', articleId: 'w', date: '2026-03-01T10:00:00.000Z', prix: 420, devise: 'EUR',
  disponibilite: 'inconnue', dispoTaille: 'inconnue', source: 'ajout',
};

async function basePrete() {
  const db = baseDeTest();
  await migrer(db);
  return db;
}

afterEach(() => definirDossierPhotos(null));

describe('sauvegarde et restauration en base', () => {
  it('restaure sur un autre téléphone toutes les pièces, relevés et photos', async () => {
    definirDossierPhotos(DOSSIER_A);
    const source = await basePrete();
    await enregistrerArticle(source, articleFictif({ id: 'w', prix: 420, imageLocale: `${DOSSIER_A}w` }), releve);
    await enregistrerArticle(source, articleFictif({ id: 'v', statut: 'achete', imageLocale: `${DOSSIER_A}v-1732500000000` }));
    await enregistrerArticle(source, articleFictif({ id: 'x', statut: 'abandonne' }));
    const { articles, releves } = await lireTout(source);
    const texte = ecrireSauvegarde(
      construireSauvegarde({ articles, releves, photos: { w: 'AAAA', 'v-1732500000000': 'BBBB' }, maintenant: new Date() }),
    );

    definirDossierPhotos(DOSSIER_B);
    const cible = await basePrete();
    await enregistrerArticle(cible, articleFictif({ id: 'ancienne' }));
    await supprimerArticle(cible, 'ancienne');
    await enregistrerArticle(cible, articleFictif({ id: 'restee' }));
    const lu = lireSauvegarde(texte);
    if (!lu.ok) throw new Error('sauvegarde refusée');
    await remplacerTout(cible, lu.sauvegarde.articles, lu.sauvegarde.releves);

    const apres = await lireTout(cible);
    expect(apres.articles.map((a) => [a.id, a.statut, a.imageLocale])).toEqual([
      ['v', 'achete', `${DOSSIER_B}v-1732500000000`],
      ['w', 'souhaite', `${DOSSIER_B}w`],
      ['x', 'abandonne', null],
    ]);
    expect(apres.releves).toEqual([releve]);
    expect(await lireArticle(cible, 'restee')).toBeNull();
    expect(cible.brute.prepare('SELECT COUNT(*) AS n FROM suppression').get()).toEqual({ n: 0 });
  });

  it('laisse la base intacte si une écriture échoue', async () => {
    const db = await basePrete();
    await enregistrerArticle(db, articleFictif({ id: 'restee' }));
    const fautif = { ...articleFictif({ id: 'y' }), statut: 'perdu' } as unknown as ReturnType<typeof articleFictif>;
    await expect(remplacerTout(db, [articleFictif({ id: 'z' }), fautif], [])).rejects.toThrow();
    expect((await lireTout(db)).articles.map((a) => a.id)).toEqual(['restee']);
  });
});
