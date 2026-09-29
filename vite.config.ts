import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/jelly-cells/',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});
