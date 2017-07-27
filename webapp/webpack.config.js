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

const STANDARD_EXCLUDE = [
    path.join(__dirname, 'node_modules'),
    path.join(__dirname, 'non_npm_dependencies')
];

var MYSTATS = {

    // Add asset Information
    assets: false,

    // Sort assets by a field
    assetsSort: '',

    // Add information about cached (not built) modules
    cached: true,

    // Show cached assets (setting this to `false` only shows emitted files)
    cachedAssets: true,

    // Add children information
    children: true,

    // Add chunk information (setting this to `false` allows for a less verbose output)
    chunks: true,

    // Add built modules information to chunk information
    chunkModules: true,

    // Add the origins of chunks and chunk merging info
    chunkOrigins: true,

    // Sort the chunks by a field
    chunksSort: '',

    // `webpack --colors` equivalent
    colors: true,

    // Display the distance from the entry point for each module
    depth: true,

    // Display the entry points with the corresponding bundles
    entrypoints: true,

    // Add errors
    errors: true,

    // Add details to errors (like resolving log)
    errorDetails: true,

    // Exclude modules which match one of the given strings or regular expressions
    exclude: [],

    // Add the hash of the compilation
    hash: true,

    // Set the maximum number of modules to be shown
    maxModules: 0,

    // Add built modules information
    modules: false,

    // Sort the modules by a field
    modulesSort: '!size',

    // Show performance hint when file size exceeds `performance.maxAssetSize`
    performance: true,

    // Show the exports of the modules
    providedExports: true,

    // Add public path information
    publicPath: true,

    // Add information about the reasons why modules are included
    reasons: true,

    // Add the source code of modules
    source: true,

    // Add timing information
    timings: true,

    // Show which exports of a module are used
    usedExports: true,

    // Add webpack version information
    version: true,

    // Add warnings
    warnings: true,

    // Filter warnings to be shown (since webpack 2.4.0),
    // can be a String, Regexp, a function getting the warning and returning a boolean
    // or an Array of a combination of the above. First match wins.
    warningsFilter: ''
};

var config = {
    entry: ['babel-polyfill', 'whatwg-fetch', './root.jsx', 'root.html'],
    output: {
        path: path.join(__dirname, 'dist'),
        publicPath: '/static/',
        filename: '[name].[hash].js',
        chunkFilename: '[name].[chunkhash].js'
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)?$/,
                exclude: STANDARD_EXCLUDE,
                use: [
                    {
                        loader: 'babel-loader',
                        options: {
                            presets: [
                                'react',
                                ['es2015', {modules: false}],
                                'stage-0'
                            ],
                            plugins: ['transform-runtime'],
                            cacheDirectory: true
                        }
                    }
                ]
            },
            {
                test: /\.json$/,
                exclude: /manifest\.json$/,
                use: [
                    {
                        loader: 'json-loader'
                    }
                ]
            },
            {
                test: /manifest\.json$/,
                use: [
                    {
                        loader: 'file-loader?name=files/[hash].[ext]'
                    }
                ]
            },
            {
                test: /(node_modules|non_npm_dependencies)(\\|\/).+\.(js|jsx)$/,
                use: [
                    {
                        loader: 'imports-loader',
                        options: {
                            $: 'jquery',
                            jQuery: 'jquery'
                        }
                    }
                ]
            },
            {
                test: /\.scss$/,
                use: [
                    {
                        loader: 'style-loader'
                    },
                    {
                        loader: 'css-loader'
                    },
                    {
                        loader: 'sass-loader',
                        options: {
                            includePaths: ['node_modules/compass-mixins/lib']
                        }
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [
                    {
                        loader: 'style-loader'
                    },
                    {
                        loader: 'css-loader'
                    }
                ]
            },
            {
                test: /\.(png|eot|tiff|svg|woff2|woff|ttf|gif|mp3|jpg)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: 'files/[hash].[ext]'
                        }
                    },
                    {
                        loader: 'image-webpack-loader',
                        options: {}
                    }
                ]
            },
            {
                test: /\.html$/,
                use: [
                    {
                        loader: 'html-loader',
                        options: {
                            attrs: 'link:href'
                        }
                    }
                ]
            }
        ]
    },
    resolve: {
        modules: [
            'node_modules',
            'non_npm_dependencies',
            path.resolve(__dirname)
        ],
        alias: {
            jquery: 'jquery/dist/jquery',
            superagent: 'node_modules/superagent/lib/client'
        },
        extensions: ['.js', '.jsx']
    },
    performance: {
        hints: 'warning'
    },
    target: 'web',
    stats: MYSTATS,
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
    ]
};

// Development mode configuration
if (DEV) {
    if (FULLMAP) {
        config.devtool = 'source-map';
    } else {
        config.devtool = 'cheap-module-eval-source-map';
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
            {from: 'images/img_trans.gif', to: 'images'},
            {from: 'images/logo-email.png', to: 'images'},
            {from: 'images/circles.png', to: 'images'},
            {from: 'images/favicon', to: 'images/favicon'},
            {from: 'images/appIcons.png', to: 'images'}
        ])
    );
}

module.exports = config;
