const webpack = require('webpack');
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const htmlExtract = new ExtractTextPlugin('html', 'root.html');

module.exports = {
    entry: ['babel-polyfill', './root.jsx', 'root.html'],
    output: {
        path: 'dist',
        publicPath: '/static/',
        filename: 'bundle.js'
    },
    devtool: 'source-map',
    module: {
        loaders: [
            {
                test: /\.jsx?$/,
                loader: 'babel-loader',
                exclude: /(node_modules|non_npm_dependencies)/,
                query: {
                    presets: ['react', 'es2015', 'stage-0'],
                    plugins: ['transform-runtime']
                }
            },
            {
                test: /\.json$/,
                loader: 'json-loader'
            },
            {
                test: /(node_modules|non_npm_dependencies)\/.+\.(js|jsx)$/,
                loader: 'imports-loader',
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
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif)$/,
                loader: 'file-loader',
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
            {from: 'images/emoji', to: 'emoji'}
        ])
    ],
    resolve: {
        alias: {
            jquery: 'jquery/dist/jquery'
        },
        modules: [
            'node_modules',
            'non_npm_dependencies',
            path.resolve(__dirname)
        ]
    }
};
