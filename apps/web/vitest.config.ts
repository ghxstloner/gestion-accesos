import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * Vitest config for `apps/web`.
 *
 * Tests are pure-TS (validators, mappers, schema). We don't yet have a DOM
 * setup; @testing-library was installed defensively but jsdom is left unused
 * until we add component tests.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
});
