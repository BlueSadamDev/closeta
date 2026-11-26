import { MIGRATIONS } from '@/db/migrations';

import { articleFictif } from '../__fixtures__/articles';
import type { RelevePrix } from '../releve';
import {
  construireSauvegarde,
  ecrireSauvegarde,
  lireSauvegarde,
  nomDeSauvegarde,
  VERSION_SAUVEGARDE,
  type Sauvegarde,
} from '../sauvegarde';

const DOSSIER = 'file:///data/user/0/fr.exemple.closeta/files/images/';
// Photos fictives : quelques octets encodés, pas de vraies images.
const PHOTO_A = 'aGFiaWxsZWU=';
const PHOTO_B = 'b3JpZ2luZQ==';

const ARTICLES = [
  articleFictif({ id: 'a', nom: 'Veste en laine', prix: 420, prixAjout: 450, imageLocale: `${DOSSIER}a`, imageSource: 'https://boutique.exemple/a.jpg' }),
  articleFictif({ id: 'b', nom: 'Pull col roulé', imageLocale: null, imageSource: 'https://boutique.exemple/b.jpg', estAlternative: true, alternativeDe: 'a' }),
  articleFictif({
    id: 'v',
    nom: 'Chemise achetée',
    statut: 'achete',
    dateAchat: '2026-02-01T10:00:00.000Z',
    imageLocale: `${DOSSIER}v-1732500000000`,
    disponibilite: 'epuise',
    dispoTaille: 'en_stock',
    dateVerif: '2026-02-02T10:00:00.000Z',
  }),
  // Photo introuvable sur le téléphone : sauvegardée sans photo locale.
  articleFictif({ id: 'p', nom: 'Pièce sans fichier', imageLocale: `${DOSSIER}p` }),
];

const RELEVES: RelevePrix[] = [
  { id: 'r1', articleId: 'a', date: '2026-03-01T10:00:00.000Z', prix: 450, devise: 'EUR', disponibilite: 'inconnue', dispoTaille: 'inconnue', source: 'ajout' },
  { id: 'r2', articleId: 'a', date: '2026-04-01T10:00:00.000Z', prix: 420, devise: 'EUR', disponibilite: 'en_stock', dispoTaille: 'epuise', source: 'relais' },
];

const MAINTENANT = new Date('2026-11-24T15:00:00.000Z');

const sauvegarde = () =>
  construireSauvegarde({
    articles: ARTICLES,
    releves: RELEVES,
    photos: { a: PHOTO_A, 'v-1732500000000': PHOTO_B },
    maintenant: MAINTENANT,
  });

/** Fichier valide modifié à la main, pour les cas abîmés. */
const modifie = (changer: (s: Record<string, unknown>) => void) => {
  const s = JSON.parse(ecrireSauvegarde(sauvegarde())) as Record<string, unknown>;
  changer(s);
  return JSON.stringify(s);
};

describe('sauvegarde : écriture', () => {
  it('suit la version du schéma de la base', () => {
    expect(VERSION_SAUVEGARDE).toBe(MIGRATIONS.length);
    expect(sauvegarde()).toMatchObject({ format: 'closeta', version: MIGRATIONS.length, date: '2026-11-24T15:00:00.000Z' });
  });

  it('nomme le fichier closeta-AAAA-MM-JJ.closeta', () => {
    expect(nomDeSauvegarde(new Date(2026, 0, 5, 9, 0))).toBe('closeta-2026-01-05.closeta');
    expect(nomDeSauvegarde(new Date(2026, 10, 24, 23, 59))).toBe('closeta-2026-11-24.closeta');
  });

  it('range chaque photo sous son nom de fichier, sans dossier', () => {
    const s = sauvegarde();
    expect(s.articles.map((a) => [a.id, a.imageLocale])).toEqual([
      ['a', 'a'],
      ['b', null],
      ['v', 'v-1732500000000'],
      ['p', null],
    ]);
    expect(s.photos).toEqual({ a: PHOTO_A, 'v-1732500000000': PHOTO_B });
    // Une photo introuvable laisse l'image d'origine intacte.
    expect(s.articles[0].imageSource).toBe('https://boutique.exemple/a.jpg');
  });

  it('ne contient aucun jeton, adresse de relais ni identifiant d’installation', () => {
    const secrets = {
      jeton: 'jeton-fictif-0123456789abcdef',
      jetonAdmin: 'admin-fictif-fedcba9876543210',
      adresseRelais: 'https://relais-fictif.exemple.workers.dev',
      idInstallation: '11111111-2222-4333-8444-555555555555',
    };
    // Même si une pièce ou un relevé portait par erreur des champs en trop, ils ne passent pas.
    const articles = ARTICLES.map((a) => ({ ...a, ...secrets }));
    const releves = RELEVES.map((r) => ({ ...r, ...secrets }));
    const texte = ecrireSauvegarde(
      construireSauvegarde({ articles, releves, photos: { a: PHOTO_A }, maintenant: MAINTENANT }),
    );
    for (const [cle, valeur] of Object.entries(secrets)) {
      expect(texte).not.toContain(valeur);
      expect(texte).not.toContain(`"${cle}"`);
    }
    expect(texte).not.toMatch(/token|jeton|installation|adresse|workers\.dev/i);
  });
});

describe('sauvegarde : lecture', () => {
  it('fait l’aller-retour complet : pièces, relevés, photos identiques', () => {
    const s = sauvegarde();
    const lu = lireSauvegarde(ecrireSauvegarde(s));
    expect(lu).toEqual({ ok: true, sauvegarde: s, resume: { pieces: 4, photos: 2 } });
  });

  it('donne le résumé « pièces, photos »', () => {
    const lu = lireSauvegarde(ecrireSauvegarde(sauvegarde()));
    expect(lu.ok && lu.resume).toEqual({ pieces: 4, photos: 2 });
  });

  it('accepte une sauvegarde vide', () => {
    const vide = construireSauvegarde({ articles: [], releves: [], photos: {}, maintenant: MAINTENANT });
    expect(lireSauvegarde(ecrireSauvegarde(vide))).toMatchObject({ ok: true, resume: { pieces: 0, photos: 0 } });
  });

  it('refuse une version plus récente de l’app', () => {
    expect(lireSauvegarde(modifie((s) => (s.version = VERSION_SAUVEGARDE + 1)))).toEqual({ ok: false, raison: 'version_recente' });
  });

  it('relit une sauvegarde de version 3 (sans prix le plus bas observé) : ce prix reste vide', () => {
    const v3 = modifie((s) => {
      s.version = 3;
      for (const a of s.articles as Record<string, unknown>[]) {
        delete a.prixMinObserve;
        delete a.datePrixMinObserve;
      }
    });
    const lu = lireSauvegarde(v3);
    expect(lu.ok).toBe(true);
    if (lu.ok) {
      expect(lu.sauvegarde.articles.every((a) => a.prixMinObserve === null && a.datePrixMinObserve === null)).toBe(true);
    }
  });

  it('refuse une version qui n’existe pas', () => {
    for (const version of [0, 2, 2.5, '3', null]) {
      expect(lireSauvegarde(modifie((s) => (s.version = version)))).toEqual({ ok: false, raison: 'illisible' });
    }
  });

  it('refuse un fichier illisible ou étranger', () => {
    const cas = [
      '',
      'pas du JSON',
      ecrireSauvegarde(sauvegarde()).slice(0, 200),
      '[]',
      'null',
      JSON.stringify({ format: 'autre', version: 3, date: '2026-11-24T15:00:00.000Z', articles: [], releves: [], photos: {} }),
    ];
    for (const texte of cas) expect(lireSauvegarde(texte)).toEqual({ ok: false, raison: 'illisible' });
  });

  it('refuse une pièce ou un relevé abîmé', () => {
    const abimes: ((s: Record<string, unknown>) => void)[] = [
      (s) => ((s.articles as Record<string, unknown>[])[0].statut = 'perdu'),
      (s) => ((s.articles as Record<string, unknown>[])[0].prix = -3),
      (s) => ((s.articles as Record<string, unknown>[])[0].nom = ''),
      (s) => ((s.articles as Record<string, unknown>[])[0].dateAjout = 'hier'),
      (s) => ((s.articles as Record<string, unknown>[])[0].estAlternative = 'oui'),
      (s) => delete (s.articles as Record<string, unknown>[])[0].type,
      (s) => ((s.articles as Record<string, unknown>[])[1].id = 'a'),
      (s) => ((s.releves as Record<string, unknown>[])[0].source = 'devine'),
      (s) => ((s.releves as Record<string, unknown>[])[0].articleId = 'absente'),
      (s) => ((s.releves as Record<string, unknown>[])[1].id = 'r1'),
      (s) => (s.articles = 'rien'),
      (s) => delete s.photos,
    ];
    for (const abimer of abimes) expect(lireSauvegarde(modifie(abimer))).toEqual({ ok: false, raison: 'illisible' });
  });

  it('refuse une photo absente, mal encodée, ou au nom dangereux', () => {
    const abimes: ((s: Record<string, unknown>) => void)[] = [
      (s) => delete (s.photos as Record<string, unknown>).a,
      (s) => ((s.photos as Record<string, unknown>).a = 'pas de la base64 !'),
      (s) => ((s.photos as Record<string, unknown>).a = ''),
      (s) => {
        (s.photos as Record<string, unknown>)['../../base.db'] = PHOTO_A;
        (s.articles as Record<string, unknown>[])[0].imageLocale = '../../base.db';
      },
    ];
    for (const abimer of abimes) expect(lireSauvegarde(modifie(abimer))).toEqual({ ok: false, raison: 'illisible' });
  });

  it('écarte un relevé dont la pièce n’est plus là', () => {
    const orphelin: RelevePrix = { ...RELEVES[0], id: 'r9', articleId: 'disparue' };
    const s = construireSauvegarde({ articles: ARTICLES, releves: [...RELEVES, orphelin], photos: {}, maintenant: MAINTENANT });
    expect(s.releves.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(lireSauvegarde(ecrireSauvegarde(s)).ok).toBe(true);
  });

  it('ignore les champs en trop et les photos inutilisées', () => {
    const lu = lireSauvegarde(
      modifie((s) => {
        s.jeton = 'jeton-fictif';
        (s.articles as Record<string, unknown>[])[0].jeton = 'jeton-fictif';
        (s.photos as Record<string, unknown>).orpheline = PHOTO_A;
      }),
    );
    expect(lu.ok).toBe(true);
    const s = (lu as { sauvegarde: Sauvegarde }).sauvegarde;
    expect(JSON.stringify(s)).not.toContain('jeton');
    expect(Object.keys(s.photos)).toEqual(['a', 'v-1732500000000']);
  });
});
