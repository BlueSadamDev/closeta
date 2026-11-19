/**
 * Génère les images PNG de l'app à partir des SVG de assets/brand/ (voir DESIGN.md, « Identité »).
 * À relancer seulement si un SVG change :  node scripts/generate-brand-images.js
 * Nécessite Playwright et Chromium (présents dans les sessions Claude Code distantes).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAPER = '#F6F3EE';
const racine = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, 'assets/brand', f), 'utf8');
const icone = lire('closeta-icone.svg');
const motSymbole = lire('closeta-mot-symbole.svg');

const images = [
  // Icône classique : fond paper plein.
  { fichier: 'icon.png', largeur: 1024, hauteur: 1024, svg: icone, fond: PAPER },
  // Icône adaptative Android : lettre seule, le fond paper vient de app.json.
  { fichier: 'android-icon-foreground.png', largeur: 1024, hauteur: 1024, svg: icone },
  // Icône monochrome (thèmes Android 13+) : même lettre, Android la recolore.
  { fichier: 'android-icon-monochrome.png', largeur: 1024, hauteur: 1024, svg: icone },
  // Écran de démarrage : mot-symbole, affiché à 32 px de corps (imageWidth dans app.json).
  { fichier: 'splash-icon.png', largeur: 1262, hauteur: 141, svg: motSymbole },
];

(async () => {
  const navigateur = await chromium.launch();
  const page = await navigateur.newPage();
  for (const img of images) {
    await page.setViewportSize({ width: img.largeur, height: img.hauteur });
    const svg = img.svg.replace('<svg ', `<svg width="${img.largeur}" height="${img.hauteur}" `);
    await page.setContent(
      `<html><body style="margin:0;background:${img.fond ?? 'transparent'}">${svg}</body></html>`,
    );
    await page.screenshot({
      path: path.join(racine, 'assets/images', img.fichier),
      omitBackground: !img.fond,
    });
    console.log('écrit', img.fichier);
  }
  await navigateur.close();
})();
