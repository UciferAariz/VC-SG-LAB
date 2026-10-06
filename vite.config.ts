/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

// Local-only app (SPEC §2, §15): relative asset paths so dist/ works from any
// local static server; fixed preview port used by the start scripts.
export default defineConfig({
  base: './',
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        vernier: resolve(root, 'vernier.html'),
        screw: resolve(root, 'screw-gauge.html'),
        notes: resolve(root, 'notes.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 90 },
    },
  },
});
