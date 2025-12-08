// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'path';

import react from '@vitejs/plugin-react-swc';
import {visualizer} from 'rollup-plugin-visualizer';
import {defineConfig, type UserConfig} from 'vite';
import checker from 'vite-plugin-checker';
import {viteStaticCopy} from 'vite-plugin-static-copy';

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
    // WebSocket target needs ws:// protocol
    const wsURL = siteURL.replace(/^http/, 'ws');

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

        // Use '/' for dev server (direct access), '/static/' for production (Go server)
        base: isDev ? '/' : publicPath,
        mode,

        plugins: [

            // Plugin to patch Rolldown's require shim to not throw for known modules
            // and to inject React module references for CJS interop
            {
                name: 'vite-plugin-patch-require-shim',
                enforce: 'post' as const,

                // DEV MODE: Transform pre-bundled deps to fix require shim
                // The Rolldown runtime's __require throws in browser - we patch it to return
                // the module from a registry that we populate with dynamic imports
                transform(code: string, id: string) {
                    if (!isDev) {
                        return null;
                    }

                    // Patch the Rolldown runtime chunk that contains the require shim
                    if (id.includes('.vite/deps/chunk-') && code.includes("doesn't expose the `require` function")) {
                        // Original: throw Error("Calling `require` for \"" + x + "\" in an...
                        // Replace with: return from registry or empty object
                        const patched = code.replace(
                            'throw Error("Calling `require` for \\"" + x + "\\"',
                            'return (globalThis.__cjs_modules__ && globalThis.__cjs_modules__[x]) || {}; void Error("',
                        );
                        return {code: patched, map: null};
                    }

                    // Patch @mattermost/components to set up the CJS registry before any require calls
                    if (id.includes('.vite/deps/@mattermost_components')) {
                        // Inject registry setup and React imports at the top
                        // IMPORTANT: Use default imports to get CJS-compatible objects with internals
                        const setupCode = `
// CJS module registry for dev mode
if (!globalThis.__cjs_modules__) {
    globalThis.__cjs_modules__ = {};
}
// Import React modules (default exports have CJS structure with internals)
import __React from 'react';
import __ReactDOM from 'react-dom';
import __ReactIs from 'react-is';
globalThis.__cjs_modules__['react'] = __React;
globalThis.__cjs_modules__['react-dom'] = __ReactDOM;
globalThis.__cjs_modules__['react-is'] = __ReactIs;
`;
                        return {code: setupCode + code, map: null};
                    }

                    return null;
                },

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
            react({
                // Use @swc/plugin-styled-components for displayName generation
                // This ensures class names include component names (e.g., SearchInputContainer-sc-abc123)
                // which is needed for CSS selectors like [class*="SearchInputContainer"]
                plugins: [
                    ['@swc/plugin-styled-components', {
                        displayName: true,
                        ssr: false,
                    }],
                ],
            }),

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

            // Static asset copying (replaces manual copy in build-vite.mjs)
            // These assets need to preserve their original filenames for runtime loading
            viteStaticCopy({
                targets: [
                    // Emoji images - loaded dynamically via getEmojiImageUrl()
                    {src: 'src/images/emoji/*', dest: 'emoji'},

                    // Static images used by server-side rendering and emails
                    {src: 'src/images/img_trans.gif', dest: 'images'},
                    {src: 'src/images/logo-email.png', dest: 'images'},
                    {src: 'src/images/favicon/*', dest: 'images/favicon'},
                    {src: 'src/images/appIcons.png', dest: 'images'},
                    {src: 'src/images/browser-icons/*', dest: 'images/browser-icons'},
                    {src: 'src/images/cloud/*', dest: 'images/cloud'},
                    {src: 'src/images/welcome_illustration_new.png', dest: 'images'},

                    // Initial loading screen CSS (loaded before JS bundle)
                    {src: 'src/components/initial_loading_screen/initial_loading_screen.css', dest: 'css'},

                    // Note: Fonts are NOT copied here - they are processed by Vite's
                    // built-in asset handling via CSS url() references in _typography.scss
                ],
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

                // Font alias for SCSS url('~fonts/...') references in _typography.scss
                // Note: General '~' prefix for node_modules is handled by SCSS importers config below
                '~fonts': path.resolve(__dirname, 'src/fonts'),

                // Workspace package aliases (resolve to source for proper bundling)
                // Subpath imports like '@mattermost/client/helpers' are prefix-matched automatically
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
                module_registry: path.resolve(__dirname, 'src/module_registry'),

                // Note: 'tests' alias not needed - test files aren't part of production build
                // Jest resolves via moduleDirectories: ['src', 'node_modules']
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
                // WebSocket endpoint (must be before /api to match first)
                '/api/v4/websocket': {
                    target: wsURL,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                },
                // API requests (HTTP)
                '/api': {
                    target: siteURL,
                    changeOrigin: true,
                    secure: false,
                },

                // Plugins
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

                // OAuth and SSO callbacks (handled by Go server)
                '/oauth': {
                    target: siteURL,
                    changeOrigin: true,
                    secure: false,
                },
                '/login/sso': {
                    target: siteURL,
                    changeOrigin: true,
                    secure: false,
                },
                '/signup_user_complete': {
                    target: siteURL,
                    changeOrigin: true,
                    secure: false,
                },
            },
            watch: {
                usePolling: false,
            },

            // T025: Pre-warm frequently accessed components for faster initial loads
            // Note: Exclude test files (*.test.tsx) since test utilities aren't available in dev
            warmup: {
                clientFiles: [
                    './src/components/app.tsx',
                    './src/components/channel_layout/**/!(*test).tsx',
                    './src/components/sidebar/**/!(*test).tsx',
                    './src/components/post_view/**/!(*test).tsx',
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

                // Workspace package with CJS interop issues (__require calls in dist)
                '@mattermost/components',
            ],
            exclude: [
                '@mattermost/client',
                '@mattermost/types',
            ],

            // Force optimization even for large dependencies
            force: false,
        },

        // Define global constants
        define: {
            'process.env': JSON.stringify(isDev ? {PUBLIC_PATH: publicPath} : {NODE_ENV: 'production'}),
            global: 'globalThis',

            // In dev mode, WebSocket connects directly to Go server (Vite proxy has known WS issues)
            // Note: Only provide base URL - the path /api/v4/websocket is appended by websocket_actions.jsx
            'import.meta.env.VITE_WEBSOCKET_URL': isDev ? JSON.stringify(wsURL) : 'undefined',
        },

        // Worker configuration for Monaco editor
        worker: {
            format: 'es',
        },

        // JSON handling - DO NOT use stringify: true as it breaks i18n JSON imports
        // Translation files need to be imported as objects, not strings
        json: {
            stringify: false,
        },
    };
});
