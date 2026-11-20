/** Les pages fictives sont importées comme du texte (suffixe ?raw, géré par vitest). */
declare module '*.html?raw' {
  const contenu: string;
  export default contenu;
}
