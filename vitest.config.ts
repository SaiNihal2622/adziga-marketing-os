import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Services tests need Next.js server context (next-auth, prisma)
    // Run them explicitly via `npx vitest run --include 'tests/services/**'`
    exclude: ["tests/services/**/*.test.ts", "node_modules/**"],
    globals: false,
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"]
    }
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname
    }
  }
});