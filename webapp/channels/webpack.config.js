// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console, no-process-env */

const fs = require('fs');
const path = require('path');

const url = require('url');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExternalTemplateRemotesPlugin = require('external-remotes-plugin');
const webpack = require('webpack');
const {ModuleFederationPlugin} = require('webpack').container;
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const WebpackPwaManifest = require('webpack-pwa-manifest');

// const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');

const packageJson = require('./package.json');

const NPM_TARGET = process.env.npm_lifecycle_event;

const targetIsRun = NPM_TARGET?.startsWith('run');
const targetIsStats = NPM_TARGET === 'stats';
const targetIsDevServer = NPM_TARGET?.startsWith('dev-server');
const targetIsEslint = NPM_TARGET === 'check' || NPM_TARGET === 'fix' || process.env.VSCODE_CWD;

const DEV = targetIsRun || targetIsStats || targetIsDevServer;

const STANDARD_EXCLUDE = [
    /node_modules/,
];

let publicPath = '/static/';

// Allow overriding the publicPath in dev from the exported SiteURL.
if (DEV) {
    const siteURL = process.env.MM_SERVICESETTINGS_SITEURL || '';
    if (siteURL) {
        publicPath = path.join(new url.URL(siteURL).pathname, 'static') + '/';
    }
}

// Track the build time so that we can bust any caches that may have incorrectly cached remote_entry.js from before we
// started setting Cache-Control: no-cache for that file on the server. This can be removed in 2024 after those cached
// entries are guaranteed to have expired.
const buildTimestamp = Date.now();

var config = {
    entry: ['./src/root.tsx'],
    output: {
        publicPath,
        filename: '[name].[contenthash].js',
        chunkFilename: '[name].[contenthash].js',
        assetModuleFilename: 'files/[contenthash][ext]',
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: STANDARD_EXCLUDE,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,

                        // Babel configuration is in .babelrc because jest requires it to be there.
                    },
                },
            },
            {
                test: /\.json$/,
                include: [
                    path.resolve(__dirname, 'src/i18n'),
                ],
                exclude: [/en\.json$/],
                type: 'asset/resource',
                generator: {
                    filename: 'i18n/[name].[contenthash].json',
                },
            },
            {
                test: /\.(css|scss)$/,
                exclude: /\/highlight\.js\//,
                use: [
                    DEV ? 'style-loader' : MiniCssExtractPlugin.loader,
                    {
                        loader: 'css-loader',
                    },
                ],
            },
            {
                test: /\.scss$/,
                use: [
                    {
                        loader: 'sass-loader',
                        options: {
                            sassOptions: {
                                includePaths: ['src', 'src/sass'],
                            },
                        },
                    },
                ],
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif|mp3|jpg)$/,
                type: 'asset/resource',
                use: [
                    {
                        loader: 'image-webpack-loader',
                        options: {},
                    },
                ],
            },
            {
                test: /\.apng$/,
                type: 'asset/resource',
            },
            {
                test: /\/highlight\.js\/.*\.css$/,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        modules: [
            'node_modules',
            './src',
        ],
        alias: {
            'mattermost-redux/test': 'packages/mattermost-redux/test',
            'mattermost-redux': 'packages/mattermost-redux/src',
            '@mui/styled-engine': '@mui/styled-engine-sc',
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        fallback: {
            crypto: require.resolve('crypto-browserify'),
            stream: require.resolve('stream-browserify'),
            buffer: require.resolve('buffer/'),
        },
    },
    performance: {
        hints: 'warning',
    },
    target: 'web',
    plugins: [
        new webpack.ProvidePlugin({
            process: 'process/browser',
        }),
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css',
            chunkFilename: '[name].[contenthash].css',
        }),
        new HtmlWebpackPlugin({
            filename: 'root.html',
            inject: 'head',
            template: 'src/root.html',
            meta: {
                csp: {
                    'http-equiv': 'Content-Security-Policy',
                    content: generateCSP(),
                },
            },
        }),
        new CopyWebpackPlugin({
            patterns: [
                {from: 'src/images/emoji', to: 'emoji'},
                {from: 'src/images/img_trans.gif', to: 'images'},
                {from: 'src/images/logo-email.png', to: 'images'},
                {from: 'src/images/circles.png', to: 'images'},
                {from: 'src/images/favicon', to: 'images/favicon'},
                {from: 'src/images/appIcons.png', to: 'images'},
                {from: 'src/images/warning.png', to: 'images'},
                {from: 'src/images/logo-email.png', to: 'images'},
                {from: 'src/images/browser-icons', to: 'images/browser-icons'},
                {from: 'src/images/cloud', to: 'images'},
                {from: 'src/images/welcome_illustration_new.png', to: 'images'},
                {from: 'src/images/logo_email_blue.png', to: 'images'},
                {from: 'src/images/logo_email_dark.png', to: 'images'},
                {from: 'src/images/logo_email_gray.png', to: 'images'},
                {from: 'src/images/forgot_password_illustration.png', to: 'images'},
                {from: 'src/images/invite_illustration.png', to: 'images'},
                {from: 'src/images/channel_icon.png', to: 'images'},
                {from: 'src/images/add_payment_method.png', to: 'images'},
                {from: 'src/images/add_subscription.png', to: 'images'},
                {from: 'src/images/c_avatar.png', to: 'images'},
                {from: 'src/images/c_download.png', to: 'images'},
                {from: 'src/images/c_socket.png', to: 'images'},
                {from: 'src/images/admin-onboarding-background.jpg', to: 'images'},
                {from: 'src/images/payment-method-illustration.png', to: 'images'},
                {from: 'src/images/cloud-laptop.png', to: 'images'},
                {from: 'src/images/cloud-laptop-error.png', to: 'images'},
                {from: 'src/images/cloud-laptop-warning.png', to: 'images'},
                {from: 'src/images/cloud-upgrade-person-hand-to-face.png', to: 'images'},
                {from: '../node_modules/pdfjs-dist/cmaps', to: 'cmaps'},
            ],
        }),

        // Generate manifest.json, honouring any configured publicPath. This also handles injecting
        // <link rel="apple-touch-icon" ... /> and <meta name="apple-*" ... /> tags into root.html.
        new WebpackPwaManifest({
            name: 'Mattermost',
            short_name: 'Mattermost',
            start_url: '..',
            description: 'Mattermost is an open source, self-hosted Slack-alternative',
            background_color: '#ffffff',
            inject: true,
            ios: true,
            fingerprints: false,
            orientation: 'any',
            filename: 'manifest.json',
            icons: [{
                src: path.resolve('src/images/favicon/android-chrome-192x192.png'),
                type: 'image/png',
                sizes: '192x192',
            }, {
                src: path.resolve('src/images/favicon/apple-touch-icon-120x120.png'),
                type: 'image/png',
                sizes: '120x120',
                ios: true,
            }, {
                src: path.resolve('src/images/favicon/apple-touch-icon-144x144.png'),
                type: 'image/png',
                sizes: '144x144',
                ios: true,
            }, {
                src: path.resolve('src/images/favicon/apple-touch-icon-152x152.png'),
                type: 'image/png',
                sizes: '152x152',
                ios: true,
            }, {
                src: path.resolve('src/images/favicon/apple-touch-icon-57x57.png'),
                type: 'image/png',
                sizes: '57x57',
                ios: true,
            }, {
                src: path.resolve('src/images/favicon/apple-touch-icon-60x60.png'),
                type: 'image/png',
                sizes: '60x60',
                ios: true,
            }, {
                src: path.resolve('src/images/favicon/apple-touch-icon-72x72.png'),
                type: 'image/png',
                sizes: '72x72',
                ios: true,
            }, {
                src: path.resolve('src/images/favicon/apple-touch-icon-76x76.png'),
                type: 'image/png',
                sizes: '76x76',
                ios: true,
            }, {
                src: path.resolve('src/images/favicon/favicon-16x16.png'),
                type: 'image/png',
                sizes: '16x16',
            }, {
                src: path.resolve('src/images/favicon/favicon-32x32.png'),
                type: 'image/png',
                sizes: '32x32',
            }, {
                src: path.resolve('src/images/favicon/favicon-96x96.png'),
                type: 'image/png',
                sizes: '96x96',
            }],
        }),

        // Disabling this plugin until we come up with better bundle analysis ci
        // new BundleAnalyzerPlugin({
        //     analyzerMode: 'disabled',
        //     generateStatsFile: true,
        //     statsFilename: 'bundlestats.json',
        // }),
    ],
};

if (DEV) {
    config.plugins.push({
        apply: (compiler) => {
            compiler.hooks.afterEmit.tap('AfterEmitPlugin', () => {
                const boardsDist = path.resolve(__dirname, '../boards/dist');
                const boardsSymlink = './dist/products/boards';
                const playbooksDist = path.resolve(__dirname, '../playbooks/dist');
                const playbooksSymlink = './dist/products/playbooks';

                fs.mkdir('./dist/products', () => {
                    if (!fs.existsSync(boardsSymlink)) {
                        fs.symlinkSync(boardsDist, boardsSymlink, 'dir');
                    }
                    if (!fs.existsSync(playbooksSymlink)) {
                        fs.symlinkSync(playbooksDist, playbooksSymlink, 'dir');
                    }
                });
            });
        },
    });
}

function generateCSP() {
    let csp = 'script-src \'self\' cdn.rudderlabs.com/ js.stripe.com/v3';

    if (DEV) {
        // react-hot-loader and development source maps require eval
        csp += ' \'unsafe-eval\'';
    }

    return csp;
}

async function initializeModuleFederation() {
    function makeSharedModules(packageNames, singleton) {
        const sharedObject = {};

        for (const packageName of packageNames) {
            const version = packageJson.dependencies[packageName];

            sharedObject[packageName] = {

                // Ensure only one copy of this package is ever loaded
                singleton,

                // Setting this to true causes the app to error out if the required version is not satisfied
                strictVersion: singleton,

                // Set these to match the specific version that the web app includes
                requiredVersion: singleton ? version : undefined,
                version,
            };
        }

        return sharedObject;
    }

    async function getRemoteContainers() {
        const products = [
            {name: 'boards'},
            {name: 'playbooks'},
        ];

        const remotes = {};
        for (const product of products) {
            remotes[product.name] = `${product.name}@[window.basename]/static/products/${product.name}/remote_entry.js?bt=${buildTimestamp}`;
        }

        return {remotes};
    }

    const {remotes} = await getRemoteContainers();

    const moduleFederationPluginOptions = {
        name: 'mattermost_webapp',
        remotes,
        shared: [

            // Shared modules will be made available to other containers (ie products and plugins using module federation).
            // To allow for better sharing, containers shouldn't require exact versions of packages like the web app does.

            // Other containers will use these shared modules if their required versions match. If they don't match, the
            // version packaged with the container will be used.
            makeSharedModules([
                '@mattermost/client',
                '@mattermost/types',
                'luxon',
                'prop-types',
            ], false),

            // Other containers will be forced to use the exact versions of shared modules that the web app provides.
            makeSharedModules([
                'history',
                'react',
                'react-beautiful-dnd',
                'react-bootstrap',
                'react-dom',
                'react-intl',
                'react-redux',
                'react-router-dom',
                'styled-components',
            ], true),
        ],
    };

    // Desktop specific code for remote module loading
    moduleFederationPluginOptions.exposes = {
        './app': 'components/app',
        './store': 'stores/redux_store.jsx',
        './styles': './src/sass/styles.scss',
        './registry': 'module_registry',
    };
    moduleFederationPluginOptions.filename = `remote_entry.js?bt=${buildTimestamp}`;

    config.plugins.push(new ModuleFederationPlugin(moduleFederationPluginOptions));

    // Add this plugin to perform the substitution of window.basename when loading remote containers
    config.plugins.push(new ExternalTemplateRemotesPlugin());

    config.plugins.push(new webpack.DefinePlugin({
        REMOTE_CONTAINERS: JSON.stringify(remotes),
    }));
}

if (DEV) {
    // Development mode configuration
    config.mode = 'development';
    config.devtool = 'eval-cheap-module-source-map';
} else {
    // Production mode configuration
    config.mode = 'production';
    config.devtool = 'source-map';
}

const env = {};
if (DEV) {
    env.PUBLIC_PATH = JSON.stringify(publicPath);
} else {
    env.NODE_ENV = JSON.stringify('production');
}

config.plugins.push(new webpack.DefinePlugin({
    'process.env': env,
}));

if (targetIsDevServer) {
    const proxyToServer = {
        logLevel: 'silent',
        target: process.env.MM_SERVICESETTINGS_SITEURL ?? 'http://localhost:8065',
        xfwd: true,
    };

    config = {
        ...config,
        devtool: 'eval-cheap-module-source-map',
        devServer: {
            liveReload: true,
            proxy: {

                // Forward these requests to the server
                '/api': {
                    ...proxyToServer,
                    ws: true,
                },
                '/plugins': proxyToServer,
                '/static/plugins': proxyToServer,
            },
            port: 9005,
            devMiddleware: {
                writeToDisk: false,
            },
            historyApiFallback: {
                index: '/static/root.html',
            },
        },
        performance: false,
        optimization: {
            ...config.optimization,
            splitChunks: false,
        },
        resolve: {
            ...config.resolve,
            alias: {
                ...config.resolve.alias,
                'react-dom': '@hot-loader/react-dom',
            },
        },
    };
}

// Export PRODUCTION_PERF_DEBUG=1 when running webpack to enable support for the react profiler
// even while generating production code. (Performance testing development code is typically
// not helpful.)
// See https://reactjs.org/blog/2018/09/10/introducing-the-react-profiler.html and
// https://gist.github.com/bvaughn/25e6233aeb1b4f0cdb8d8366e54a3977
if (process.env.PRODUCTION_PERF_DEBUG) {
    console.log('Enabling production performance debug settings'); //eslint-disable-line no-console
    config.resolve.alias['react-dom'] = 'react-dom/profiling';
    config.resolve.alias['schedule/tracing'] = 'schedule/tracing-profiling';
    config.optimization = {

        // Skip minification to make the profiled data more useful.
        minimize: false,
    };
}

if (targetIsEslint) {
    // ESLint can't handle setting an async config, so just skip the async part
    module.exports = config;
} else {
    module.exports = async () => {
        // Do this asynchronously so we can determine whether which remote modules are available
        await initializeModuleFederation();

        return config;
    };
}
