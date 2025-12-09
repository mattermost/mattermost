// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import react from '@vitejs/plugin-react-swc';
import {defineConfig, type UserConfig} from 'vite';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Vite configuration for the Mattermost Platform library.
 * This is the shared component library used by channels and other packages.
 */
export default defineConfig(({mode}): UserConfig => {
    const isDev = mode === 'development';

    return {
        root: __dirname,
        mode,

        plugins: [
            react(),
        ],

        resolve: {
            alias: {
                '@mattermost/types': path.resolve(__dirname, 'types/src'),
                '@mattermost/client': path.resolve(__dirname, 'client/src'),
                '@mattermost/components': path.resolve(__dirname, 'components/src'),
            },
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },

        build: {
            target: ['chrome130', 'firefox132', 'safari18', 'edge130'],
            lib: {
                entry: {
                    types: path.resolve(__dirname, 'types/src/index.ts'),
                    client: path.resolve(__dirname, 'client/src/index.ts'),
                    components: path.resolve(__dirname, 'components/src/index.ts'),
                },
                formats: ['es'],
            },
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: isDev ? 'inline' : true,
            minify: isDev ? false : 'esbuild',
            rollupOptions: {
                external: [
                    'react',
                    'react-dom',
                    'styled-components',
                ],
                output: {
                    preserveModules: true,
                    preserveModulesRoot: '.',
                },
            },
        },

        // Platform is a library, not an app - no dev server needed
        optimizeDeps: {
            include: ['react', 'react-dom'],
        },
    };
});
