'use strict';
var path = require('path');
var webpack = require('webpack');

var commonLoaders = [
  {test: /.*\.(gif|png|jpe?g|svg)$/i, loaders: [
    'file?hash=sha512&digest=hex&name=[hash].[ext]',
    '../index.js?{progressive:true,optimizationLevel:7,interlaced:false}']},
];
var assetsPath = path.join(__dirname, 'public/assets');
var publicPath = 'assets/';
var extensions = [''];

module.exports = [
  {
    entry: './test/app.js',
    output: {
      path: assetsPath,
      publicPath: publicPath,
      filename: 'app.[hash].js'
    },
    resolve: {
      extensions: extensions
    },
    module: {
      loaders: commonLoaders
    },
    imageWebpackLoader: {
      pngquant:{
        quality: "65-90",
        speed: 4
      },
      svgo:{
        plugins: [
          {
            removeViewBox: false
          },
          {
            removeEmptyAttrs: false
          }
        ]
      }
    }
  }
];
