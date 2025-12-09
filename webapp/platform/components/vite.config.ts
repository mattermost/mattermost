// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import react from '@vitejs/plugin-react-swc';
import {defineConfig, type UserConfig} from 'vite';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Vite configuration for the Mattermost Components library.
 * Builds as an ES module library with CSS extraction.
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
                '@mattermost/types': path.resolve(__dirname, '../types/src'),
                '@mattermost/client': path.resolve(__dirname, '../client/src'),
            },
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },

        css: {
            modules: {
                localsConvention: 'camelCaseOnly',
            },
            preprocessorOptions: {
                scss: {
                    api: 'modern',
                    loadPaths: [
                        path.resolve(__dirname, 'src'),
                        path.resolve(__dirname, 'node_modules'),
                        path.resolve(__dirname, '..', 'node_modules'),
                    ],
                },
            },
        },

        build: {
            target: ['chrome130', 'firefox132', 'safari18', 'edge130'],
            lib: {
                entry: path.resolve(__dirname, 'src/index.tsx'),
                formats: ['es'],
                fileName: () => 'index.esm.js',
            },
            outDir: 'dist',
            emptyOutDir: true,
            sourcemap: isDev ? 'inline' : true,
            minify: false, // Library code should not be minified
            cssCodeSplit: false, // Single CSS file
            rollupOptions: {
                external: [
                    'react',
                    'react-dom',
                    'react-intl',
                    'styled-components',
                    'classnames',
                    'lodash',
                    'shallow-equals',
                    'tippy.js',
                    '@tippyjs/react',
                    '@mattermost/compass-icons',
                    /^react-bootstrap/,
                    /^@mattermost\/types/,
                    /^@mattermost\/client/,
                ],
                output: {
                    // Preserve module structure for tree-shaking
                    preserveModules: false,
                    // CSS file name
                    assetFileNames: (assetInfo) => {
                        if (assetInfo.name?.endsWith('.css')) {
                            return 'index.esm.css';
                        }
                        return 'assets/[name][extname]';
                    },
                },
            },
        },

        // No dev server needed for library
        optimizeDeps: {
            include: ['react', 'react-dom'],
        },
    };
});
