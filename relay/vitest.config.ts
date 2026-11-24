import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // « cloudflare:workers » n'existe que chez Cloudflare : remplacé par un équivalent minimal pour les tests.
  resolve: { alias: { 'cloudflare:workers': fileURLToPath(new URL('./test/cloudflare-workers.ts', import.meta.url)) } },
  test: { include: ['test/**/*.test.ts'] },
});
