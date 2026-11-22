/**
 * Description de la photo par l'IA de Cloudflare (Workers AI).
 * L'IA ne fait que décrire ce qu'elle voit : type, catégorie, couleur, matière, marque lisible,
 * et une courte recherche pour Google Shopping. Ce qu'elle ne sait pas vaut null : rien n'est inventé.
 */
import { settings } from './settings';

/** Accès à Workers AI fourni par Cloudflare (déclaré dans wrangler.toml). */
export interface IA {
  run(modele: string, entree: Record<string, unknown>): Promise<unknown>;
}

export type Description = {
  type: 'vetement' | 'chaussures' | null;
  categorie: string | null;
  couleur: string | null;
  matiere: string | null;
  marque: string | null;
  /** Courte recherche en français pour trouver des articles proches (Google Shopping). */
  recherche: string | null;
};

export const DESCRIPTION_VIDE: Description = {
  type: null,
  categorie: null,
  couleur: null,
  matiere: null,
  marque: null,
  recherche: null,
};

const CATEGORIES = {
  vetement: ['Haut', 'Chemise', 'Pull', 'Maille', 'Pantalon', 'Jean', 'Veste', 'Manteau'],
  chaussures: ['Baskets', 'Mocassins', 'Derbies', 'Bottines', 'Sandales'],
};

const CONSIGNE = `Tu décris un vêtement ou une paire de chaussures à partir d'une photo, pour une application de wishlist.
Réponds uniquement avec l'objet JSON demandé, en français.
- type : "vetement" ou "chaussures" ; null si la photo ne montre ni l'un ni l'autre.
- categorie : de préférence un de ces mots : ${CATEGORIES.vetement.join(', ')} (vêtements) ; ${CATEGORIES.chaussures.join(', ')} (chaussures). Un autre mot simple si aucun ne convient. null si tu ne sais pas.
- couleur : la couleur principale, en un ou deux mots (ex. « bleu marine »).
- matiere : seulement si elle se voit clairement (ex. « velours côtelé », « daim »), sinon null.
- marque : seulement si un logo ou une étiquette est lisible sur la photo. Ne devine jamais une marque : null sinon.
- recherche : 3 à 8 mots pour trouver cet article en boutique en ligne (ex. « veste velours côtelé marron homme »). null si la photo ne montre pas de vêtement ni de chaussures.`;

const texteOuNull = { anyOf: [{ type: 'string' }, { type: 'null' }] };

const SCHEMA = {
  type: 'object',
  properties: {
    type: { anyOf: [{ type: 'string', enum: ['vetement', 'chaussures'] }, { type: 'null' }] },
    categorie: texteOuNull,
    couleur: texteOuNull,
    matiere: texteOuNull,
    marque: texteOuNull,
    recherche: texteOuNull,
  },
  required: ['type', 'categorie', 'couleur', 'matiere', 'marque', 'recherche'],
  additionalProperties: false,
};

/** Encode la photo en base64 par morceaux (évite de dépasser la taille maximale d'un appel). */
export function enBase64(octets: Uint8Array): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(binaire);
}

const nettoie = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (t === '' || /^(null|inconnu|inconnue|aucune?|n\/a|non visible)$/i.test(t)) return null;
  return t.slice(0, max);
};

/**
 * Lit la réponse de l'IA (format « chat completions » de Workers AI, ou objet déjà lu).
 * Tout champ absent, vide ou mal formé vaut null.
 */
export function lireDescription(reponse: unknown): Description {
  let brut: unknown = reponse;
  const r = reponse as { choices?: { message?: { content?: unknown } }[]; response?: unknown } | null;
  if (r && Array.isArray(r.choices)) brut = r.choices[0]?.message?.content;
  else if (r && 'response' in r) brut = r.response;
  if (typeof brut === 'string') {
    // Certains modèles entourent le JSON de texte ou de balises ``` : on garde l'objet.
    const debut = brut.indexOf('{');
    const fin = brut.lastIndexOf('}');
    if (debut < 0 || fin <= debut) return DESCRIPTION_VIDE;
    try {
      brut = JSON.parse(brut.slice(debut, fin + 1));
    } catch {
      return DESCRIPTION_VIDE;
    }
  }
  if (typeof brut !== 'object' || brut === null) return DESCRIPTION_VIDE;
  const o = brut as Record<string, unknown>;
  const type = o.type === 'vetement' || o.type === 'chaussures' ? o.type : null;
  return {
    type,
    categorie: nettoie(o.categorie, 40),
    couleur: nettoie(o.couleur, 40),
    matiere: nettoie(o.matiere, 40),
    marque: nettoie(o.marque, 60),
    recherche: nettoie(o.recherche, 120),
  };
}

/** Demande la description de la photo à l'IA. En cas d'échec ou de délai dépassé : description vide. */
export async function decrirePhoto(ia: IA, photo: Uint8Array, signaler: (e: unknown) => void = () => undefined): Promise<Description> {
  const appel = ia.run(settings.modeleIA, {
    messages: [
      { role: 'system', content: CONSIGNE },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Décris cet article.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${enBase64(photo)}` } },
        ],
      },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'description', schema: SCHEMA, strict: true } },
    // Réponse directe, sans « réflexion » préalable : plus rapide et moins de calcul consommé.
    chat_template_kwargs: { enable_thinking: false },
    max_tokens: 300,
    temperature: 0.2,
  });
  let minuterie: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<null>((resoudre) => {
    minuterie = setTimeout(() => resoudre(null), settings.delaiIAMs);
  });
  try {
    const reponse = await Promise.race([appel, delai]);
    if (reponse === null) {
      signaler(new Error('délai dépassé'));
      return DESCRIPTION_VIDE;
    }
    const description = lireDescription(reponse);
    if (!description.recherche) signaler(new Error(`réponse sans recherche : ${JSON.stringify(reponse).slice(0, 120)}`));
    return description;
  } catch (e) {
    signaler(e);
    return DESCRIPTION_VIDE;
  } finally {
    clearTimeout(minuterie);
  }
}
