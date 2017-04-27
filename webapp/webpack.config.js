const webpack = require('webpack');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const nodeExternals = require('webpack-node-externals');

const HtmlWebpackPlugin = require('html-webpack-plugin');

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
    entry: ['babel-polyfill', 'whatwg-fetch', './root.jsx', 'root.html'],
    output: {
        path: 'dist',
        publicPath: '/static/',
        filename: '[name].[hash].js',
        chunkFilename: '[name].[chunkhash].js'
    },
    module: {
        loaders: [
            {
                test: /\.(js|jsx)?$/,
                loader: 'babel-loader',
                exclude: /(node_modules|non_npm_dependencies)/,
                query: {
                    presets: [
                        'react',
                        ['es2015', {modules: false}],
                        'stage-0'
                    ],
                    plugins: ['transform-runtime'],
                    cacheDirectory: DEV
                }
            },
            {
                test: /\.json$/,
                exclude: /manifest\.json$/,
                loader: 'json-loader'
            },
            {
                test: /manifest\.json$/,
                loader: 'file-loader?name=files/[hash].[ext]'
            },
            {
                test: /(node_modules|non_npm_dependencies)(\\|\/).+\.(js|jsx)$/,
                loader: 'imports-loader',
                query: {
                    $: 'jquery',
                    jQuery: 'jquery'
                }
            },
            {
                test: /\.scss$/,
                use: [{
                    loader: 'style-loader'
                }, {
                    loader: 'css-loader'
                }, {
                    loader: 'sass-loader',
                    options: {
                        includePaths: ['node_modules/compass-mixins/lib']
                    }
                }]
            },
            {
                test: /\.css$/,
                loaders: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif|mp3|jpg)$/,
                loaders: [
                    'file-loader?name=files/[hash].[ext]',
                    'image-webpack-loader'
                ]
            },
            {
                test: /\.html$/,
                loader: 'html-loader?attrs=link:href'
            }
        ]
    },
    plugins: [
        new webpack.ProvidePlugin({
            'window.jQuery': 'jquery'
        }),
        new webpack.LoaderOptionsPlugin({
            minimize: !DEV,
            debug: false
        }),
        new webpack.optimize.CommonsChunkPlugin({
            minChunks: 2,
            children: true
        })
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
            comments: false,
            sourceMap: true
        })
    );
    config.plugins.push(
        new webpack.optimize.OccurrenceOrderPlugin(true)
    );
    config.plugins.push(
        new webpack.DefinePlugin({
            'process.env': {
                NODE_ENV: JSON.stringify('production')
            }
        })
    );
}

// Test mode configuration
if (TEST) {
    config.entry = ['babel-polyfill', './root.jsx'];
    config.target = 'node';
    config.externals = [nodeExternals()];
} else {
    // For some reason these break mocha. So they go here.
    config.plugins.push(
        new HtmlWebpackPlugin({
            filename: 'root.html',
            inject: 'head',
            template: 'root.html'
        })
    );
    config.plugins.push(
        new CopyWebpackPlugin([
            {from: 'images/emoji', to: 'emoji'},
            {from: 'images/logo-email.png', to: 'images'},
            {from: 'images/circles.png', to: 'images'},
            {from: 'images/favicon', to: 'images/favicon'},
            {from: 'images/appIcons.png', to: 'images'}
        ])
    );
}

module.exports = config;
