/**
 * Découpe un texte en morceaux normaux et en morceaux « en relief ».
 * Dans src/domain/texts/, le relief est balisé entre astérisques : « Complète *le prix*. »
 */
export type Segment = { texte: string; relief: boolean };

export function parseRelief(source: string): Segment[] {
  const segments: Segment[] = [];
  source.split('*').forEach((texte, i) => {
    // Les morceaux d'indice impair sont entre deux astérisques.
    if (texte !== '') segments.push({ texte, relief: i % 2 === 1 });
  });
  return segments;
}
