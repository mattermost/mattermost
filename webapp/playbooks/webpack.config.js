/* eslint-disable no-console, no-process-env */

const path = require('path');

const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
const {ModuleFederationPlugin} = require('webpack').container;

const NPM_TARGET = process.env.npm_lifecycle_event;

const targetIsRun = NPM_TARGET?.startsWith('start');

const DEV = targetIsRun;

const TARGET_IS_PRODUCT = NPM_TARGET?.endsWith(':product');
const mode = 'production';
const devtool = 'source-map';
const plugins = [];

const config = {
    entry: './src/remote_entry.ts',
    resolve: {
        alias: {
            src: path.resolve(__dirname, './src/'),
            'mattermost-redux': path.resolve(__dirname, '../channels/src/packages/mattermost-redux/src/'),
            '@mattermost/client': path.resolve(__dirname, '../platform/client/src/'),
            '@mattermost/components': path.resolve(__dirname, '../platform/components/src/'),
        },
        modules: [
            'src',
            'node_modules',
        ],
        extensions: ['*', '.js', '.jsx', '.ts', '.tsx'],
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx|ts|tsx)$/,
                exclude: /node_modules\/(?!(mattermost-webapp)\/).*/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,

                        // Babel configuration is in babel.config.js because jest requires it to be there.
                    },
                },
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
                ],
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif|mp3|jpg|jpeg)$/,
                type: 'asset/inline', // consider 'asset' when URL resource chunks are supported
            },
        ],
    },
    devtool,
    mode,
    plugins,
};

config.plugins.push(new MiniCssExtractPlugin({
    filename: '[name].[contenthash].css',
    chunkFilename: '[name].[contenthash].css',
}));

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
    name: 'playbooks',
    filename: 'remote_entry.js',
    exposes: {
        '.': './src/index',
    },
    shared: [
        '@mattermost/client',
        '@types/luxon',
        '@types/react-bootstrap',

        makeSingletonSharedModules([
            'react',
            'react-dom',
            'react-intl',
            'react-redux',
            'react-router-dom',
            'styled-components',
            'react-bootstrap',
            'luxon',
        ]),
    ],
}));

config.plugins.push(new webpack.DefinePlugin({
    'process.env.TARGET_IS_PRODUCT': TARGET_IS_PRODUCT, // TODO We might want a better name for this
}));

config.output = {
    path: path.join(__dirname, '/dist'),
    chunkFilename: '[name].[contenthash].js',
};

module.exports = config;
