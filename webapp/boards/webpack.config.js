// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const exec = require('child_process').exec;
const path = require('path');

const webpack = require('webpack');
const {ModuleFederationPlugin} = webpack.container;
const tsTransformer = require('@formatjs/ts-transformer');

const NPM_TARGET = process.env.npm_lifecycle_event; //eslint-disable-line no-process-env

let mode = 'production';
let devtool;
const plugins = [];
if (NPM_TARGET === 'debug' || NPM_TARGET === 'debug:watch' || NPM_TARGET === 'start:product') {
    mode = 'development';
    devtool = 'source-map';
    plugins.push(
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('development'),
        }),
    );
}

if (NPM_TARGET === 'build:watch' || NPM_TARGET === 'debug:watch' || NPM_TARGET === 'live-watch') {
    plugins.push({
        apply: (compiler) => {
            compiler.hooks.watchRun.tap('WatchStartPlugin', () => {
                // eslint-disable-next-line no-console
                console.log('Change detected. Rebuilding webapp.');
            });
            compiler.hooks.afterEmit.tap('AfterEmitPlugin', () => {
                let command = 'cd .. && make deploy-from-watch';
                if (NPM_TARGET === 'live-watch') {
                    command = 'cd .. && make deploy-to-mattermost-directory';
                }
                exec(command, (err, stdout, stderr) => {
                    if (stdout) {
                        process.stdout.write(stdout);
                    }
                    if (stderr) {
                        process.stderr.write(stderr);
                    }
                });
            });
        },
    });
}

const config = {
    entry: './src/remote_entry.ts',
    resolve: {
        alias: {
            src: path.resolve(__dirname, './src/'),
            // 'mattermost-redux': path.resolve(__dirname, '../channels/src/packages/mattermost-redux/src/'),
            // reselect: path.resolve(__dirname, '../channels/src/packages/reselect/src/index'),
            '@mattermost/client': path.resolve(__dirname, '../platform/client/src/'),
            '@mattermost/components': path.resolve(__dirname, '../platform/components/src/'),
        },
        modules: [
            path.resolve(__dirname, './src'),
            path.resolve(__dirname, '.'),
            'node_modules',
        ],
        extensions: ['*', '.js', '.jsx', '.ts', '.tsx'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        compilerOptions: {
                            noEmit: false,
                        },
                        getCustomTransformers: {
                            before: [
                                tsTransformer.transform({
                                    overrideIdFn: '[sha512:contenthash:base64:6]',
                                    ast: true,
                                }),
                            ],
                        },
                    },
                },
                exclude: [/node_modules/],
            },
            {
                test: /\.html$/,
                type: 'asset/resource',
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader',
                    path.resolve(__dirname, 'loaders/globalScssClassLoader'),
                ],
            },
            {
                test: /\.css$/i,
                use: [
                    'style-loader',
                    'css-loader',
                ],
            },
            {
                test: /\.(tsx?|js|jsx|mjs|html)$/,
                use: [
                ],
                exclude: [/node_modules/],
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|jpg|gif)$/,
                type: 'asset/resource',
                generator: {
                    filename: '[name][ext]',
                    publicPath: undefined,
                },
            },
        ],
    },
    devtool,
    mode,
    plugins,
};

// Set up module federation
function makeSingletonSharedModules(packageNames) {
    const sharedObject = {};

    for (const packageName of packageNames) {
        sharedObject[packageName] = {

            // Ensure only one copy of this package is ever loaded
            singleton: true,

            // Set this to false to prevent Webpack from packaging any "fallback" version of this package so that
            // only the version provided by the web app will be used
            import: false,

            // Set these to false so that any version provided by the web app will be accepted
            requiredVersion: false,
            version: false
        };
    }

    return sharedObject;
}

config.plugins.push(new ModuleFederationPlugin({
    name: 'boards',
    filename: 'remote_entry.js',
    exposes: {
        '.': './src/index',

        // This probably won't need to be exposed in the long run, but its a POC for exposing multiple modules
        './manifest': './src/manifest',
    },
    shared: [
        '@mattermost/client',
        'prop-types',

        makeSingletonSharedModules([
            'react',
            'react-dom',
            'react-intl',
            'react-redux',
            'react-router-dom',
        ]),
    ],
}));

config.output = {
    path: path.join(__dirname, '/dist'),
    chunkFilename: '[name].[contenthash].js',
};

/* eslint-disable no-process-env */
const env = {};
env.RUDDER_KEY = JSON.stringify(process.env.RUDDER_KEY || '');
env.RUDDER_DATAPLANE_URL = JSON.stringify(process.env.RUDDER_DATAPLANE_URL || '');

config.plugins.push(new webpack.DefinePlugin({
    'process.env': env,
}));

if (NPM_TARGET === 'start:product') {
    const url = new URL(process.env.MM_BOARDS_DEV_SERVER_URL ?? 'http://localhost:9006');

    config.devServer = {
        server: {
            type: url.protocol.substring(0, url.protocol.length - 1),
            options: {
                minVersion: process.env.MM_SERVICESETTINGS_TLSMINVER ?? 'TLSv1.2',
                key: process.env.MM_SERVICESETTINGS_TLSKEYFILE,
                cert: process.env.MM_SERVICESETTINGS_TLSCERTFILE,
            },
        },
        host: url.hostname,
        port: url.port,
        devMiddleware: {
            writeToDisk: false,
        },
        static: {
            directory: path.join(__dirname, 'static'),
            publicPath: '/static',
        },
    };
}
/* eslint-enable no-process-env */

module.exports = config;
