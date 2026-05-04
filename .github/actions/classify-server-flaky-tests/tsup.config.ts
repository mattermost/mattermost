import {defineConfig} from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    outDir: "dist",
    clean: true,
    noExternal: [/.*/],
    minify: false,
    sourcemap: false,
    target: "node24",
});
