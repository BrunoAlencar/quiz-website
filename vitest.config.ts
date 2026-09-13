import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
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
