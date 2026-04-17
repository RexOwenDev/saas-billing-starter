import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/types/**/*.ts"],
      exclude: ["src/lib/supabase/**", "src/lib/stripe/client.ts"],
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // server-only throws outside Next.js server context.
      // Replace with a no-op in the test environment.
      "server-only": resolve(__dirname, "tests/__mocks__/server-only.ts"),
    },
  },
});
