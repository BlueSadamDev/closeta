import { parseRelief } from '../relief';

describe('parseRelief', () => {
  it('rend un texte sans relief en un seul morceau normal', () => {
    expect(parseRelief('Prix à compléter')).toEqual([{ texte: 'Prix à compléter', relief: false }]);
  });

  it('isole le morceau entre astérisques', () => {
    expect(parseRelief('3 pièces · *1 485 €*')).toEqual([
      { texte: '3 pièces · ', relief: false },
      { texte: '1 485 €', relief: true },
    ]);
  });

  it('garde le texte qui suit le relief', () => {
    expect(parseRelief('Belle pièce. Elle *rejoint ton Vestiaire*.')).toEqual([
      { texte: 'Belle pièce. Elle ', relief: false },
      { texte: 'rejoint ton Vestiaire', relief: true },
      { texte: '.', relief: false },
    ]);
  });
});
