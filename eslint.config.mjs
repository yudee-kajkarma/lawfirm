import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    // Multi-tenancy guardrail: raw `.aggregate(` bypasses tenantScopePlugin
    // (middleware doesn't run on aggregations). Use tenantAggregate() instead.
    // Allowed only inside the helper itself and the smoke test that proves
    // the leak exists.
    files: ['**/*.{ts,tsx}'],
    ignores: [
      'lib/tenancy/tenantAggregate.ts',
      'scripts/test-tenant-scope.ts',
      // operator-console code (added in MT-3) can opt out per-line with
      // // eslint-disable-next-line no-restricted-syntax -- cross-tenant, intentional
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='aggregate']",
          message:
            'Use tenantAggregate() from lib/tenancy/tenantAggregate — raw .aggregate() bypasses tenant scoping.',
        },
      ],
    },
  },
];

export default config;
