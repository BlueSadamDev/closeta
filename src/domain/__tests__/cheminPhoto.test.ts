import { versCheminDePhoto, versNomDePhoto } from '../cheminPhoto';

const DOSSIER = 'file:///data/user/0/fr.exemple.closeta/files/images/';

describe('chemin des photos', () => {
  it('ne garde en base que le nom d’une photo du dossier de l’app', () => {
    expect(versNomDePhoto(`${DOSSIER}a1-1732400000000`, DOSSIER)).toBe('a1-1732400000000');
    // Dossier donné sans « / » final : même résultat.
    expect(versNomDePhoto(`${DOSSIER}a1`, DOSSIER.slice(0, -1))).toBe('a1');
  });

  it('garde entière toute autre valeur (rien n’est perdu)', () => {
    expect(versNomDePhoto('file:///cache/ImagePicker/photo.jpg', DOSSIER)).toBe('file:///cache/ImagePicker/photo.jpg');
    expect(versNomDePhoto(`${DOSSIER}sous/dossier`, DOSSIER)).toBe(`${DOSSIER}sous/dossier`);
    expect(versNomDePhoto('a1', DOSSIER)).toBe('a1');
    expect(versNomDePhoto(null, DOSSIER)).toBeNull();
    expect(versNomDePhoto(`${DOSSIER}a1`, null)).toBe(`${DOSSIER}a1`);
  });

  it('recalcule le chemin complet d’un nom, garde un chemin complet tel quel', () => {
    expect(versCheminDePhoto('a1', DOSSIER)).toBe(`${DOSSIER}a1`);
    expect(versCheminDePhoto('file:///ancien/chemin/a1', DOSSIER)).toBe('file:///ancien/chemin/a1');
    expect(versCheminDePhoto(null, DOSSIER)).toBeNull();
  });

  it('fait l’aller-retour : chemin → nom → même chemin', () => {
    const chemin = `${DOSSIER}v2-1732500000000`;
    expect(versCheminDePhoto(versNomDePhoto(chemin, DOSSIER), DOSSIER)).toBe(chemin);
  });

  it('retrouve la photo dans le dossier d’un autre téléphone ou de l’autre APK', () => {
    const autre = 'file:///data/user/0/fr.exemple.closeta.dev/files/images/';
    expect(versCheminDePhoto(versNomDePhoto(`${DOSSIER}a1`, DOSSIER), autre)).toBe(`${autre}a1`);
  });
});
