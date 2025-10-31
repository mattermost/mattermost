// This file has been automatically migrated to valid ESM format by Storybook.
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type {StorybookConfig} from '@storybook/react-webpack5';
import path, { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Monorepo support: Helper to resolve absolute paths to Storybook packages
// This ensures proper module resolution in monorepo environments (Yarn workspaces, Lerna, etc.)
// See: https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments
const getAbsolutePath = (packageName: string): any =>
    path.dirname(require.resolve(path.join(packageName, 'package.json'))).replace(/^file:\/\//, '');

const config: StorybookConfig = {
    stories: [
        './docs/*.mdx',
        // Channels stories
        '../src/**/*.mdx',
        '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
        // Platform stories
        '../../platform/components/src/**/*.mdx',
        '../../platform/components/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
        // Design System stories
        '../../platform/design-system/src/**/*.mdx',
        '../../platform/design-system/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    ],
    addons: [
        getAbsolutePath('@storybook/addon-a11y'),
        getAbsolutePath("@storybook/addon-webpack5-compiler-babel"),
        getAbsolutePath("@storybook/addon-docs")
    ],
    framework: {
        // Use getAbsolutePath for monorepo compatibility
        name: getAbsolutePath('@storybook/react-webpack5'),
        options: {},
    },
    docs: {},
    typescript: {
        reactDocgen: false, // Disable react-docgen to avoid Babel issues
        check: false, // Disable type-checking for faster builds
    },
    // Configure Babel for better TypeScript support
    babel: async (options) => ({
        ...options,
        presets: [
            ...(options.presets || []),
            ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
        ],
    }),
    webpackFinal: async (config) => {
        // Extend Storybook's Webpack config to match Mattermost's Webpack configuration

        // Add module resolution to match webapp config
        if (config.resolve) {
            config.resolve.modules = [
                ...(config.resolve.modules || []),
                'node_modules',
                path.resolve(__dirname, '../src'),
            ];

            config.resolve.alias = {
                ...config.resolve.alias,

                // CRITICAL: Ensure single React instance across all packages
                // This prevents "Invalid hook call" errors in monorepo setup
                react: path.resolve(__dirname, '../../node_modules/react'),
                'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
                'react-redux': path.resolve(__dirname, '../../node_modules/react-redux'),

                // Mirror webapp's Webpack aliases
                'mattermost-redux/test': path.resolve(__dirname, '../src/packages/mattermost-redux/test'),
                'mattermost-redux': path.resolve(__dirname, '../src/packages/mattermost-redux/src'),
                '@mui/styled-engine': path.resolve(__dirname, '../../node_modules/@mui/styled-engine-sc'),
                'styled-components': path.resolve(__dirname, '../../node_modules/styled-components'),

                // Platform package aliases
                '@mattermost/components': path.resolve(__dirname, '../../platform/components/src'),
                '@mattermost/types': path.resolve(__dirname, '../../platform/types/src'),
                '@mattermost/client': path.resolve(__dirname, '../../platform/client/src'),

                // Webapp source aliases
                components: path.resolve(__dirname, '../src/components'),
                utils: path.resolve(__dirname, '../src/utils'),
                actions: path.resolve(__dirname, '../src/actions'),
                stores: path.resolve(__dirname, '../src/stores'),
                selectors: path.resolve(__dirname, '../src/selectors'),
                hooks: path.resolve(__dirname, '../src/hooks'),
                sass: path.resolve(__dirname, '../src/sass'),
                i18n: path.resolve(__dirname, '../src/i18n'),
                packages: path.resolve(__dirname, '../src/packages'),
                reducers: path.resolve(__dirname, '../src/reducers'),
                images: path.resolve(__dirname, '../src/images'),
            };

            config.resolve.extensions = [
                ...(config.resolve.extensions || []),
                '.ts',
                '.tsx',
                '.js',
                '.jsx',
                '.json',
            ];

            // Add fallbacks for Node.js modules (matching webapp config)
            config.resolve.fallback = {
                ...config.resolve.fallback,
                crypto: require.resolve('crypto-browserify'),
                stream: require.resolve('stream-browserify'),
                buffer: require.resolve('buffer/'),
                process: require.resolve('process/browser.js'),
            };
        }

        // Add SCSS loader rules matching webapp's Webpack config
        config.module = config.module || {};
        config.module.rules = config.module.rules || [];

        // Find and modify existing CSS/SCSS rules or add new ones
        const rules = config.module.rules;

        // Remove Storybook's default CSS rules and add our own
        const filteredRules = rules.filter((rule) => {
            if (typeof rule === 'object' && rule !== null && 'test' in rule) {
                const test = rule.test;
                if (test instanceof RegExp) {
                    // Keep rules that don't match CSS/SCSS
                    return !test.test('.css') && !test.test('.scss');
                }
            }
            return true;
        });

        // Add webapp-style CSS and SCSS rules with proper loader chain
        // CSS files
        filteredRules.push({
            test: /\.css$/,
            use: [
                'style-loader',
                {
                    loader: 'css-loader',
                    options: {
                        importLoaders: 0,
                    },
                },
            ],
        });

        // SCSS files with sass-loader configured for Mattermost
        filteredRules.push({
            test: /\.scss$/,
            use: [
                'style-loader',
                {
                    loader: 'css-loader',
                    options: {
                        importLoaders: 2, // Important: tells css-loader to run sass-loader first
                    },
                },
                {
                    loader: require.resolve('sass-loader'),
                    options: {
                        implementation: require('sass'),
                        sassOptions: {
                            // Set load paths for @use and @import resolution
                            // This allows @use "utils/mixins" to resolve to src/sass/utils/_mixins.scss
                            loadPaths: [
                                path.resolve(__dirname, '../src/sass'),
                                path.resolve(__dirname, '../src'),
                                path.resolve(__dirname, '../../platform/design-system/src'),
                                path.resolve(__dirname, '../../platform/components/src'),
                                path.resolve(__dirname, '../../node_modules'),
                            ],
                        },
                    },
                },
            ],
        });

        config.module.rules = filteredRules;

        // Add webpack plugins for Node.js polyfills
        config.plugins = config.plugins || [];
        const webpack = require('webpack');
        config.plugins.push(
            new webpack.ProvidePlugin({
                process: 'process/browser.js',
                Buffer: ['buffer', 'Buffer'],
            })
        );

        return config;
    },
};

export default config;
