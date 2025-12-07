// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import react from '@vitejs/plugin-react-swc';
import {visualizer} from 'rollup-plugin-visualizer';
import {defineConfig, type UserConfig} from 'vite';
import checker from 'vite-plugin-checker';

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
const __dirname = path.dirname(new URL(import.meta.url).pathname);

/**
 * Vite configuration for the Mattermost Channels web application.
 * Extends the base configuration with channels-specific settings.
 */
export default defineConfig(({mode}): UserConfig => {
    const isDev = mode === 'development';
    // eslint-disable-next-line no-process-env
    const siteURL = process.env.MM_SERVICESETTINGS_SITEURL || 'http://localhost:8065';

    // Determine public path based on environment
    let publicPath = '/static/';
    if (isDev && siteURL) {
        try {
            const url = new URL(siteURL);
            publicPath = path.join(url.pathname, 'static') + '/';
        } catch {
            // Use default if URL parsing fails
        }
    }

    return {
        root: __dirname,
        base: publicPath,
        mode,

        plugins: [

            // Plugin to patch Rolldown's require shim to not throw for known modules
            // and to inject React module references for CJS interop
            {
                name: 'vite-plugin-patch-require-shim',
                enforce: 'post' as const,
                generateBundle(_options: any, bundle: Record<string, any>) {
                    // Find the entry chunk to inject __cjs_modules__ setup
                    let entryChunk: { code: string; fileName: string } | null = null;

                    for (const fileName of Object.keys(bundle)) {
                        const chunk = bundle[fileName];
                        if (chunk.type === 'chunk' && chunk.isEntry) {
                            entryChunk = chunk;
                        }
                    }

                    for (const fileName of Object.keys(bundle)) {
                        const chunk = bundle[fileName];
                        if (chunk.type === 'chunk' && chunk.code) {
                            // Replace the throwing require shim with one that returns from globalThis.__cjs_modules__
                            // This handles CJS modules that have runtime require() calls
                            if (chunk.code.includes("doesn't expose the `require` function")) {
                                // CRITICAL: Must use `return` to actually return the module from the outer function!
                                // The IIFE executes and returns the module, but without `return` the result is discarded
                                const replacement = `return(globalThis.__cjs_modules__&&globalThis.__cjs_modules__[e])||{}; void Error('Calling \`require\` for "'+e+`;
                                chunk.code = chunk.code.split("throw Error('Calling `require` for \"'+e+").join(replacement);
                            }
                        }
                    }

                    // Inject __cjs_modules__ initialization at the very start of the entry chunk
                    // and populate it with React modules from the bundled factories
                    if (entryChunk) {
                        const code = entryChunk.code;

                        // Detect React and react-is factory variable names by content patterns
                        // This is more robust than hardcoding minified variable names which can change
                        let reactVar: string | null = null;
                        let reactIsVar: string | null = null;

                        // Find all CJS wrapper patterns: varName=s(((e,t)=>{t.exports=innerVar()}))
                        // These wrap the actual module implementations
                        const cjsWrapperRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*)=s\(\(\(e,t\)=>\{t\.exports=([a-zA-Z_$][a-zA-Z0-9_$]*)\(\)\}\)\)/g;
                        const wrappers: Array<{varName: string; innerVar: string}> = [];
                        let match;
                        while ((match = cjsWrapperRegex.exec(code)) !== null) {
                            wrappers.push({varName: match[1], innerVar: match[2]});
                        }

                        // For each wrapper, find the inner factory and check what it EXPORTS
                        // IMPORTANT: Look for `e.PROP=` pattern (export), not just containing the string
                        for (const wrapper of wrappers) {
                            // Find the inner factory definition and check its exports
                            // React EXPORTS e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=
                            // react-is EXPORTS e.typeOf=, e.isFragment=, e.isMemo=, etc.
                            const innerFactoryRegex = new RegExp(
                                wrapper.innerVar + `=s\\(\\(e=>\\{`,
                                'g',
                            );
                            const innerMatch = innerFactoryRegex.exec(code);
                            if (innerMatch) {
                                const factoryStart = innerMatch.index;
                                // Get ~5000 chars of context to check exports (React module is large)
                                const factoryContext = code.slice(factoryStart, factoryStart + 5000);

                                // React module EXPORTS __SECRET_INTERNALS (has e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=)
                                // JSX runtime only USES it internally, doesn't export it
                                if (factoryContext.includes('e.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=')) {
                                    reactVar = wrapper.varName;
                                } else if (factoryContext.includes('e.typeOf=') && factoryContext.includes('e.isFragment=')) {
                                    reactIsVar = wrapper.varName;
                                }
                            }
                        }

                        // Initialize __cjs_modules__ at the start
                        const initCode = `globalThis.__cjs_modules__=globalThis.__cjs_modules__||{};`;
                        entryChunk.code = initCode + entryChunk.code;

                        // Build populate code dynamically based on detected variable names
                        let populateCode = `(function(){var g=globalThis.__cjs_modules__;`;
                        if (reactVar) {
                            populateCode += `if(typeof ${reactVar}==="function")g.react=g.react||${reactVar}();`;
                        }
                        if (reactIsVar) {
                            populateCode += `if(typeof ${reactIsVar}==="function")g["react-is"]=g["react-is"]||${reactIsVar}();`;
                        }
                        populateCode += `})();`;

                        // Log detected variables for debugging
                        // eslint-disable-next-line no-console
                        console.log(`[vite-plugin-patch-require-shim] Detected: react=${reactVar}, react-is=${reactIsVar}`);

                        // CRITICAL: Inject populate code BEFORE the bootstrap async function
                        // The bootstrap() function does dynamic imports which trigger chunk loading
                        // Those chunks may need React, so __cjs_modules__ must be populated first
                        // Pattern: "async function XX()" where XX is the minified bootstrap name
                        const asyncFuncMatch = entryChunk.code.match(/async function ([a-zA-Z_$][a-zA-Z0-9_$]*)\(\)\{/);
                        if (asyncFuncMatch && asyncFuncMatch.index !== undefined) {
                            entryChunk.code = entryChunk.code.slice(0, asyncFuncMatch.index) +
                                populateCode +
                                entryChunk.code.slice(asyncFuncMatch.index);
                        } else {
                            // Fallback: inject before exports if no async function found
                            const exportMatch = entryChunk.code.match(/export\{[^}]+\}/);
                            if (exportMatch && exportMatch.index !== undefined) {
                                entryChunk.code = entryChunk.code.slice(0, exportMatch.index) +
                                    populateCode +
                                    entryChunk.code.slice(exportMatch.index);
                            }
                        }
                    }
                },
            },

            // Plugin to handle highlight.js CSS imports as URLs (loaded via XHR at runtime)
            {
                name: 'vite-plugin-highlightjs-css',
                enforce: 'pre' as const,
                async transform(code: string, id: string) {
                    // Transform imports of highlight.js CSS files to add ?url suffix
                    // This returns the URL of the CSS file so code can load it via XHR
                    if (id.endsWith('.ts') || id.endsWith('.tsx')) {
                        const hljsImportRegex = /from\s+['"]highlight\.js\/styles\/([^'"]+\.css)['"]/g;
                        if (hljsImportRegex.test(code)) {
                            return code.replace(
                                /from\s+['"]highlight\.js\/styles\/([^'"]+\.css)['"]/g,
                                'from "highlight.js/styles/$1?url"',
                            );
                        }
                    }
                    return null;
                },
            },
            react(),

            // TypeScript error checking with overlay (T028)
            isDev && checker({
                typescript: {
                    tsconfigPath: './tsconfig.json',
                    buildMode: false,
                },
                overlay: {
                    initialIsOpen: false,
                    position: 'br',
                },
                enableBuild: false,
            }),

            // T040: Bundle analysis (only in production with VITE_BUNDLE_ANALYZER=true)
            // eslint-disable-next-line no-process-env
            !isDev && process.env.VITE_BUNDLE_ANALYZER === 'true' && visualizer({
                filename: 'dist/bundle-stats.html',
                open: true,
                gzipSize: true,
                brotliSize: true,
                template: 'treemap',
            }),
        ].filter(Boolean),

        resolve: {
            // Dedupe React to prevent multiple instances
            dedupe: ['react', 'react-dom', 'react-is', 'styled-components'],
            alias: {

                // Handle webpack ~ prefix for node_modules imports (used in SCSS)
                '~': path.resolve(__dirname, 'node_modules'),

                // Font alias for SCSS url() references
                '~fonts': path.resolve(__dirname, 'src/fonts'),

                // Workspace package aliases (resolve to source for proper bundling)
                // Note: @mattermost/client/lib imports need special handling
                '@mattermost/client/lib': path.resolve(__dirname, '..', 'platform', 'client', 'src'),
                '@mattermost/client': path.resolve(__dirname, '..', 'platform', 'client', 'src'),
                '@mattermost/types': path.resolve(__dirname, '..', 'platform', 'types', 'src'),

                // @mattermost/components - alias src/ subpath for direct component imports
                '@mattermost/components/src': path.resolve(__dirname, '..', 'platform', 'components', 'src'),

                // Internal package aliases
                'mattermost-redux': path.resolve(__dirname, 'src/packages/mattermost-redux/src'),

                // Material UI styled-components engine
                '@mui/styled-engine': '@mui/styled-engine-sc',

                // Ensure single version of styled-components (force ESM entry)
                'styled-components': path.resolve(__dirname, '..', 'node_modules', 'styled-components', 'dist', 'styled-components.browser.esm.js'),

                // Source directory shorthand - matching webpack resolve.modules
                '@': path.resolve(__dirname, 'src'),
                actions: path.resolve(__dirname, 'src/actions'),
                client: path.resolve(__dirname, 'src/client'),
                components: path.resolve(__dirname, 'src/components'),
                hooks: path.resolve(__dirname, 'src/hooks'),
                i18n: path.resolve(__dirname, 'src/i18n'),
                images: path.resolve(__dirname, 'src/images'),
                packages: path.resolve(__dirname, 'src/packages'),
                plugins: path.resolve(__dirname, 'src/plugins'),
                reducers: path.resolve(__dirname, 'src/reducers'),
                sass: path.resolve(__dirname, 'src/sass'),
                selectors: path.resolve(__dirname, 'src/selectors'),
                sounds: path.resolve(__dirname, 'src/sounds'),
                store: path.resolve(__dirname, 'src/store'),
                stores: path.resolve(__dirname, 'src/stores'),
                types: path.resolve(__dirname, 'src/types'),
                utils: path.resolve(__dirname, 'src/utils'),
                tests: path.resolve(__dirname, 'src/tests'),
                module_registry: path.resolve(__dirname, 'src/module_registry'),
            },
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },

        css: {
            modules: {
                localsConvention: 'camelCaseOnly',
            },
            preprocessorOptions: {

                // Cast to any to allow Sass modern API options not yet in TypeScript types
                scss: {
                    api: 'modern',

                    // Use loadPaths for modern Sass API (@use and @forward support)
                    loadPaths: [
                        path.resolve(__dirname, 'src/sass'),
                        path.resolve(__dirname, 'node_modules'),
                        path.resolve(__dirname, '..', 'node_modules'),
                    ],

                    // Silence deprecation warnings for legacy code
                    silenceDeprecations: ['legacy-js-api', 'import'],

                    // Handle webpack ~ prefix for node_modules imports
                    importers: [{
                        findFileUrl(url: string) {
                            if (url.startsWith('~')) {
                                const modulePath = url.slice(1);

                                // Try channels node_modules first, then webapp node_modules
                                const localPath = path.resolve(__dirname, 'node_modules', modulePath);
                                const parentPath = path.resolve(__dirname, '..', 'node_modules', modulePath);
                                // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
                                const fs = require('fs');
                                if (fs.existsSync(localPath)) {
                                    return new URL(`file://${localPath}`);
                                }
                                if (fs.existsSync(parentPath)) {
                                    return new URL(`file://${parentPath}`);
                                }
                            }
                            return null;
                        },
                    }],
                } as any,
            },
        },

        envPrefix: 'VITE_',

        build: {
            target: ['chrome130', 'firefox132', 'safari18', 'edge130'],
            outDir: 'dist',
            emptyOutDir: true,

            // T043: Source maps for production debugging
            sourcemap: isDev ? 'inline' : true,

            // T038: Minification (Rolldown uses Oxc minifier by default)
            minify: !isDev,

            // T039: CSS minification (Rolldown uses Lightning CSS by default)
            cssMinify: !isDev,
            cssCodeSplit: true,
            rolldownOptions: {
                input: {
                    root: path.resolve(__dirname, 'root.html'),
                },
                output: {
                    assetFileNames: 'assets/[name].[hash][extname]',
                    chunkFileNames: 'chunks/[name].[hash].js',
                    entryFileNames: '[name].[hash].js',
                },
                treeshake: true,
            },
            chunkSizeWarningLimit: 1000,

            // Reduce memory usage during build
            reportCompressedSize: false,
        },

        // Development server configuration
        server: {
            port: 9005,
            strictPort: true,
            host: true,
            hmr: {
                overlay: true,
                port: 9006,
            },
            proxy: {
                '/api': {
                    target: siteURL,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                },
                '/plugins': {
                    target: siteURL,
                    changeOrigin: true,
                    secure: false,
                },
                '/static/plugins': {
                    target: siteURL,
                    changeOrigin: true,
                    secure: false,
                },
            },
            watch: {
                usePolling: false,
            },

            // T025: Pre-warm frequently accessed components for faster initial loads
            warmup: {
                clientFiles: [
                    './src/components/app.tsx',
                    './src/components/channel_layout/**/*.tsx',
                    './src/components/sidebar/**/*.tsx',
                    './src/components/post_view/**/*.tsx',
                    './src/stores/redux_store.tsx',
                    './src/sass/styles.scss',
                ],
            },
        },

        // Preview server (production build preview)
        preview: {
            port: 9005,
            strictPort: true,
        },

        // Dependency optimization (T026, T027)
        optimizeDeps: {
            include: [

                // React core
                'react',
                'react-dom',
                'react-dom/client',
                'react-is',

                // State management
                'react-redux',
                'redux',
                'redux-thunk',
                'redux-persist',

                // Routing
                'react-router-dom',
                'history',

                // Internationalization
                'react-intl',
                'intl-messageformat',
                'tslib',

                // UI libraries
                'styled-components',
                'react-bootstrap',
                'react-select',
                'react-beautiful-dnd',
                '@tippyjs/react',

                // Utilities
                'luxon',
                'lodash',
                'classnames',
                'fast-deep-equal',
                'memoize-one',

                // Monaco Editor (heavy dependency)
                'monaco-editor',
            ],
            exclude: [

                // Exclude workspace packages that should be linked rather than bundled
                '@mattermost/client',
                '@mattermost/types',
                '@mattermost/components',
            ],

            // T027: Hold until full dependency crawl is complete to prevent reload thrashing
            holdUntilCrawlEnd: true,

            // Force optimization even for large dependencies
            force: false,
        },

        // Define global constants
        define: {
            'process.env': JSON.stringify(isDev ? {PUBLIC_PATH: publicPath} : {NODE_ENV: 'production'}),
            global: 'globalThis',

            // For remote_entry.js compatibility
            REMOTE_CONTAINERS: JSON.stringify({}),
        },

        // Worker configuration for Monaco editor
        worker: {
            format: 'es',
        },

        // JSON handling
        json: {
            stringify: true,
        },

        // Note: Vite 8 uses Oxc instead of esbuild. No configuration needed.
        // The "crypto" externalization warning is expected - Node.js crypto
        // doesn't work in browsers, and Vite handles this automatically.
    };
});
