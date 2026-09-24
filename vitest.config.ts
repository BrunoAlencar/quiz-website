import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

// Vitest does not load .env files on its own. The DB-backed tests read
// DATABASE_URL_TEST from process.env, so load the project's .env files here
// (an already-exported env var still wins over the file).
const fileEnv = loadEnv("test", process.cwd(), "");

export default defineConfig({
  test: {
    environment: "node",
    env: fileEnv,
    include: ["tests/**/*.test.ts"],
    // Multiple test files share the same Postgres test DB and TRUNCATE the
    // same tables in beforeEach; running files in parallel worker threads
    // can trigger real Postgres deadlocks. Serialize file execution instead.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
