import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 keeps most configuration inside `globals.css` via `@theme`,
 * but we still expose a TS config for editor/IDE tooling and `content` hints.
 * The actual design tokens live in `app/globals.css` (`@theme` block).
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};

export default config;
