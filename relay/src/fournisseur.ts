/**
 * Choix du fournisseur de recherche (variable RECHERCHE_FOURNISSEUR, défaut « serpapi »), pour pouvoir
 * en changer plus tard sans toucher aux routes. Fournisseur inconnu ou sans clé : aucune recherche payante.
 */
import type { FournisseurRecherche } from './recherche';
import { fournisseurSerpApi } from './serpapi';
import { settings } from './settings';

export function fournisseurRecherche(env: { RECHERCHE_FOURNISSEUR?: string; SERPAPI_KEY?: string }): FournisseurRecherche | null {
  const nom = (env.RECHERCHE_FOURNISSEUR ?? '').trim().toLowerCase() || settings.fournisseurRechercheDefaut;
  if (nom === 'serpapi') return env.SERPAPI_KEY ? fournisseurSerpApi(env.SERPAPI_KEY) : null;
  return null;
}
