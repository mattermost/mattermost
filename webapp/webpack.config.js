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
                loader: 'babel',
                exclude: /(node_modules|non_npm_dependencies)/,
                query: {
                    presets: ['react', 'es2015-webpack', 'stage-0'],
                    plugins: ['transform-runtime'],
                    cacheDirectory: true
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
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif)$/,
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
            {from: 'images/emoji', to: 'emoji'}
        ]),
        new webpack.optimize.UglifyJsPlugin({
            'screw-ie8': true,
            mangle: {
                toplevel: false
            },
            compress: {
                warnings: false
            },
            comments: false
        }),
        new webpack.optimize.AggressiveMergingPlugin(),
        new webpack.LoaderOptionsPlugin({
            minimize: true,
            debug: false
        })
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
