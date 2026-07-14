import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      '**/.agents/**',
      '**/docs/**',
      '**/skills-lock.json',
      '**/postcss.config.js',
      '**/next.config.ts',
      '**/tailwind.config.ts',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // The shadcn primitives ship a handful of empty-component interfaces
      // (`React.ComponentProps<...>` aliases) that are intentional; mute the
      // rule rather than rewrite the primitives.
      '@typescript-eslint/no-empty-object-type': 'off',
      // `react-compiler` lint surfaces "set-state-in-effect" inside shadcn
      // primitives (carousel select订阅). Disable for primitives only via per-file.
      'react-hooks/incompatible-library': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

export default eslintConfig;
