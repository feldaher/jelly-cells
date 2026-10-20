import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// CELL_ENGINE=local npm run dev uses the engine next door (projects/cell-engine/engine) instead of the pinned tag.
const localEngine = process.env.CELL_ENGINE === 'local'
  ? { '@feldaher/cell-engine': fileURLToPath(new URL('../../cell-engine/engine/src', import.meta.url)) }
  : {};

export default defineConfig({
  base: '/jelly-cells/',
  build: { target: 'es2022' },
  resolve: { alias: localEngine },
  optimizeDeps: { exclude: ['@feldaher/cell-engine'] },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/*.sync-conflict-*', 'node_modules/**'],
    testTimeout: 60000,
    server: { deps: { inline: ['@feldaher/cell-engine'] } },
  },
});
