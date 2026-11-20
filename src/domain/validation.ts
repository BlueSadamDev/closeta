import type { Priorite, TypeArticle } from './article';
import { lirePrix } from './prix';

/** Ce que contient le formulaire (tout est du texte saisi, sauf les choix). */
export type Brouillon = {
  nom: string;
  marque: string;
  type: TypeArticle | null;
  categorie: string;
  taille: string;
  couleur: string;
  prix: string;
  urlBoutique: string;
  priorite: Priorite;
  notes: string;
};

export const BROUILLON_VIDE: Brouillon = {
  nom: '',
  marque: '',
  type: null,
  categorie: '',
  taille: '',
  couleur: '',
  prix: '',
  urlBoutique: '',
  priorite: 'moyenne',
  notes: '',
};

export type ChampsValides = {
  nom: string;
  marque: string | null;
  type: TypeArticle;
  categorie: string | null;
  taille: string | null;
  couleur: string | null;
  prix: number | null;
  urlBoutique: string | null;
  priorite: Priorite;
  notes: string | null;
};

export type ErreurChamp = 'nomManquant' | 'typeManquant' | 'prixInvalide' | 'lienInvalide';
export type Erreurs = Partial<Record<'nom' | 'type' | 'prix' | 'urlBoutique', ErreurChamp>>;

const texteOuNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** Vérifie le formulaire : nom et type obligatoires, prix et lien bien formés s'ils sont remplis. */
export function validerBrouillon(b: Brouillon): { ok: true; champs: ChampsValides } | { ok: false; erreurs: Erreurs } {
  const erreurs: Erreurs = {};
  if (b.nom.trim() === '') erreurs.nom = 'nomManquant';
  if (b.type === null) erreurs.type = 'typeManquant';
  const prix = lirePrix(b.prix);
  if (prix === 'invalide') erreurs.prix = 'prixInvalide';
  const url = b.urlBoutique.trim();
  if (url !== '' && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)) erreurs.urlBoutique = 'lienInvalide';

  if (Object.keys(erreurs).length > 0 || b.type === null || prix === 'invalide') return { ok: false, erreurs };

  return {
    ok: true,
    champs: {
      nom: b.nom.trim(),
      marque: texteOuNull(b.marque),
      type: b.type,
      categorie: texteOuNull(b.categorie),
      taille: texteOuNull(b.taille),
      couleur: texteOuNull(b.couleur),
      prix,
      urlBoutique: url === '' ? null : url,
      priorite: b.priorite,
      notes: texteOuNull(b.notes),
    },
  };
}
