/* eslint-disable no-console, no-process-env */

const path = require('path');

const webpack = require('webpack');
const {ModuleFederationPlugin} = require('webpack').container;

const NPM_TARGET = process.env.npm_lifecycle_event;
const TARGET_IS_PRODUCT = NPM_TARGET?.endsWith(':product');
const mode = 'production';
const devtool = 'source-map';
const plugins = [];

const config = {
    entry: './src/remote_entry.ts',
    resolve: {
        alias: {
            src: path.resolve(__dirname, './src/'),
            'mattermost-redux': path.resolve(__dirname, './node_modules/mattermost-webapp/packages/mattermost-redux/src/'),
            reselect: path.resolve(__dirname, './node_modules/mattermost-webapp/packages/reselect/src/index'),
            '@mattermost/client': path.resolve(__dirname, './node_modules/mattermost-webapp/packages/client/src/'),
            '@mattermost/components': path.resolve(__dirname, './node_modules/mattermost-webapp/packages/components/src/'),
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
                test: /\.scss$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                    },
                    {
                        loader: 'sass-loader',
                    },
                ],
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif|mp3|jpg|jpeg)$/,
                type: 'asset/inline', // consider 'asset' when URL resource chunks are supported
            },
            {
                test: /\.apng$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: 'files/[contenthash].[ext]',
                        },
                    },
                ],
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
config.externals = {
    react: 'React',
    'react-dom': 'ReactDOM',
    redux: 'Redux',
    luxon: 'Luxon',
    'react-redux': 'ReactRedux',
    'prop-types': 'PropTypes',
    'react-bootstrap': 'ReactBootstrap',
    'react-router-dom': 'ReactRouterDom',
    'react-intl': 'ReactIntl',
};

if (NPM_TARGET === 'start:product') {
    const url = new URL(process.env.MM_PLAYBOOKS_DEV_SERVER_URL ?? 'http://localhost:9007');

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
    };
}

module.exports = config;
