import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      // Mirrored in the repo root's sonar.coverage.exclusions — a file skipped
      // here emits no lcov entry, so Sonar must not count it as uncovered either.
      exclude: [
        // Machine-written by server/scripts/gen-plugin-facts.ts.
        'src/generated/**',
        // Generated snapshot (scripts/gen-lucide-icon-names.mjs) — pure data.
        'src/lucide-icon-names.ts',
      ],
    },
  },
});
