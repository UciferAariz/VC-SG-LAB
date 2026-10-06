import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Dev scripts run in Node and pass callbacks into the browser page.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: Object.fromEntries(
        ['process', 'console', 'window', 'document', 'performance', 'requestAnimationFrame', 'getComputedStyle', 'innerWidth', 'innerHeight'].map((g) => [g, 'readonly']),
      ),
    },
  },
  {
    // HARD RULE (SPEC §3): core/ is pure logic — no DOM, no UI, no Math.random.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/render/**', '**/ui/**', '**/input/**', '**/audio/**'], message: 'core/ must not import from rendering, UI, input or audio code.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'core/ must not touch window.' },
        { name: 'document', message: 'core/ must not touch document.' },
        { name: 'navigator', message: 'core/ must not touch navigator.' },
        { name: 'localStorage', message: 'core/ must not touch storage.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded PRNG in core/rng.ts.' },
      ],
    },
  },
);
