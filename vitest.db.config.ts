import { defineConfig } from "vitest/config";

// Database tests: apply every migration to a throwaway Postgres database and
// check row level security. Requires TEST_DATABASE_URL.
export default defineConfig({
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
