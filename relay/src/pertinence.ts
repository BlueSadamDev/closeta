/**
 * Ordre des correspondances Google Lens selon ce que l'IA a vu sur la photo.
 * Lens retrouve parfois la bonne image sur la page d'une autre pièce (la casquette portée avec la veste) :
 * les résultats dont le nom correspond au vêtement vu passent devant. Rien n'est écarté, seul l'ordre change.
 */
import type { Description } from './ia';

/** Familles de pièces : les mots d'une même famille désignent le même genre de vêtement. */
const FAMILLES: readonly (readonly string[])[] = [
  ['veste', 'blouson', 'doudoune', 'manteau', 'parka', 'jacket', 'coat', 'puffer', 'anorak', 'trench', 'caban', 'perfecto', 'bomber'],
  ['pull', 'pullover', 'sweat', 'sweatshirt', 'gilet', 'cardigan', 'maille', 'sweater', 'hoodie', 'jumper'],
  ['chemise', 'surchemise', 'shirt', 'blouse'],
  ['haut', 'top', 'tee', 'shirt', 'polo', 'debardeur'],
  ['pantalon', 'jean', 'jeans', 'chino', 'trousers', 'pants', 'denim'],
  ['basket', 'baskets', 'sneaker', 'sneakers', 'tennis', 'trainers'],
  ['mocassin', 'mocassins', 'loafer', 'loafers'],
  ['derby', 'derbies', 'richelieu', 'richelieus', 'oxford'],
  ['bottine', 'bottines', 'boots', 'boot', 'chelsea', 'botte', 'bottes'],
  ['sandale', 'sandales', 'sandal', 'sandals', 'mules'],
];

/** Accessoires : un résultat qui n'en parle que n'est pas la pièce cherchée. */
const ACCESSOIRES = ['casquette', 'cap', 'bonnet', 'chapeau', 'hat', 'beanie', 'sac', 'bag', 'ceinture', 'belt', 'echarpe', 'scarf', 'gants', 'gloves', 'lunettes', 'bijou', 'collier', 'bracelet', 'chaussettes', 'socks'];

/** Mots en minuscules, sans accents ni ponctuation. */
export function mots(texte: string | null): string[] {
  if (!texte) return [];
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((m) => m.length > 0);
}

/** Famille de la pièce vue par l'IA (catégorie d'abord, puis la recherche qu'elle a écrite). */
export function familleVue(d: Description): readonly string[] | null {
  for (const source of [mots(d.categorie), mots(d.recherche)]) {
    for (const mot of source) {
      const famille = FAMILLES.find((f) => f.includes(mot));
      if (famille) return famille;
    }
  }
  return null;
}

/** Note d'un nom de résultat : +3 s'il nomme le même genre de pièce, +1 par mot de couleur ou de matière, -3 si accessoire seul. */
export function note(titre: string, d: Description, famille: readonly string[] | null): number {
  const t = new Set(mots(titre));
  let total = 0;
  const memePiece = famille ? famille.some((m) => t.has(m)) : false;
  if (memePiece) total += 3;
  else if (ACCESSOIRES.some((m) => t.has(m))) total -= 3;
  for (const m of new Set([...mots(d.couleur), ...mots(d.matiere)])) if (m.length >= 4 && t.has(m)) total += 1;
  return total;
}

/** Trie les résultats du plus pertinent au moins pertinent ; à note égale, l'ordre d'origine est gardé. */
export function classer<T extends { nom: string }>(resultats: T[], d: Description): T[] {
  const famille = familleVue(d);
  return resultats
    .map((r, i) => ({ r, i, n: note(r.nom, d, famille) }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.r);
}
