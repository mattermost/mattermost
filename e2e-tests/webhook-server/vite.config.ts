import {defineConfig} from 'vite';

export default defineConfig({
    build: {
        target: 'node24',
        outDir: 'dist',
        lib: {
            entry: 'src/server.ts',
            formats: ['es'],
            fileName: 'server',
        },
        rollupOptions: {
            external: ['express', /^node:/],
        },
        minify: false,
        sourcemap: true,
    },
});
