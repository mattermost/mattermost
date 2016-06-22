const webpack = require('webpack');
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const htmlExtract = new ExtractTextPlugin('html', 'root.html');

const NPM_TARGET = process.env.npm_lifecycle_event; //eslint-disable-line no-process-env

var DEV = false;
var FULLMAP = false;
var TEST = false;
if (NPM_TARGET === 'run' || NPM_TARGET === 'run-fullmap') {
    DEV = true;
    if (NPM_TARGET === 'run-fullmap') {
        FULLMAP = true;
    }
}

if (NPM_TARGET === 'test') {
    DEV = false;
    TEST = true;
}

var config = {
    entry: ['babel-polyfill', './root.jsx', 'root.html'],
    output: {
        path: 'dist',
        publicPath: '/static/',
        filename: 'bundle.js'
    },
    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                loader: 'babel',
                exclude: /(node_modules|non_npm_dependencies)/,
                query: {
                    presets: ['react', 'es2015-webpack', 'stage-0'],
                    plugins: ['transform-runtime'],
                    cacheDirectory: DEV
                }
            },
            {
                test: /node_modules\/mattermost\/client\.jsx?$/,
                loader: 'babel',
                query: {
                    presets: ['react', 'es2015-webpack', 'stage-0'],
                    plugins: ['transform-runtime'],
                    cacheDirectory: DEV
                }
            },
            {
                test: /\.json$/,
                loader: 'json'
            },
            {
                test: /(node_modules|non_npm_dependencies)\/.+\.(js|jsx)$/,
                loader: 'imports',
                query: {
                    $: 'jquery',
                    jQuery: 'jquery'
                }
            },
            {
                test: /\.scss$/,
                loaders: ['style', 'css', 'sass']
            },
            {
                test: /\.css$/,
                loaders: ['style', 'css']
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif|mp3|jpg)$/,
                loader: 'file',
                query: {
                    name: 'files/[hash].[ext]'
                }
            },
            {
                test: /\.html$/,
                loader: htmlExtract.extract('html?attrs=link:href')
            }
        ]
    },
    sassLoader: {
        includePaths: ['node_modules/compass-mixins/lib']
    },
    plugins: [
        new webpack.ProvidePlugin({
            'window.jQuery': 'jquery'
        }),
        htmlExtract,
        new CopyWebpackPlugin([
            {from: 'images/emoji', to: 'emoji'},
            {from: 'images/logo-email.png', to: 'images'},
            {from: 'images/circles.png', to: 'images'}
        ]),
        new webpack.LoaderOptionsPlugin({
            minimize: !DEV,
            debug: false
        }),
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify('production')
            }
        }),
        new webpack.optimize.CommonsChunkPlugin({
            minChunks: 2,
            children: true,
            name: 'main'
        })
        //new webpack.optimize.AggressiveMergingPlugin()
    ],
    resolve: {
        alias: {
            jquery: 'jquery/dist/jquery',
            superagent: 'node_modules/superagent/lib/client'
        },
        modules: [
            'node_modules',
            'non_npm_dependencies',
            path.resolve(__dirname)
        ]
    }
};

// Development mode configuration
if (DEV) {
    if (FULLMAP) {
        config.devtool = 'source-map';
    } else {
        config.devtool = 'eval-cheap-module-source-map';
    }
}

// Production mode configuration
if (!DEV) {
    config.devtool = 'source-map';
    config.plugins.push(
        new webpack.optimize.UglifyJsPlugin({
            'screw-ie8': true,
            mangle: {
                toplevel: false
            },
            compress: {
                warnings: false
            },
            comments: false
        })
    );
    config.plugins.push(
        new webpack.optimize.OccurrenceOrderPlugin(true)
    );
    config.plugins.push(
        new webpack.optimize.DedupePlugin()
    );
}

// Test mode configuration
if (TEST) {
    config.externals = [nodeExternals()];
}

module.exports = config;
