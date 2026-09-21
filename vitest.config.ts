import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/src/__test__/**/*.test.ts"],
  },
});