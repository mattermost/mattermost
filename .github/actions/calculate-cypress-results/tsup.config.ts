import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    target: "node24",
    clean: true,
    minify: false,
    sourcemap: false,
    splitting: false,
    bundle: true,
    noExternal: [/.*/],
});
