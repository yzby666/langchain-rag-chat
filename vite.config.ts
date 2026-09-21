import { resolve } from "node:path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "lib/src",
      exclude: ["lib/src/__test__/**"],
    }),
  ],
  build: {
    outDir: "dist",
    lib: {
      entry: resolve(import.meta.dirname, "lib/src/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      external: [
        /^node:/,
        /^@langchain\//,
        "langchain",
        "cheerio",
        "pdf-parse",
      ],
    },
  },
});
