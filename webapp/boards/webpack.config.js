// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const exec = require('child_process').exec;
const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
const {ModuleFederationPlugin} = webpack.container;
const tsTransformer = require('@formatjs/ts-transformer');

const NPM_TARGET = process.env.npm_lifecycle_event; //eslint-disable-line no-process-env

const targetIsRun = NPM_TARGET?.startsWith('start');
const targetIsDebug = NPM_TARGET?.startsWith('debug');

const DEV = targetIsRun || targetIsDebug;

let mode = 'production';
let devtool;
const plugins = [];
if (DEV) {
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
                test: /\.(css|scss)$/,
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
                    'sass-loader',
                    path.resolve(__dirname, 'loaders/globalScssClassLoader'),
                ],
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|jpg|gif)$/,
                type: 'asset/resource',
                generator: {
                    filename: '[name][ext]',
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
            version: false,
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

config.plugins.push(new MiniCssExtractPlugin({
    filename: '[name].[contenthash].css',
    chunkFilename: '[name].[contenthash].css',
}));

module.exports = config;
