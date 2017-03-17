# babel-loader [![NPM Status](https://img.shields.io/npm/v/babel-loader.svg?style=flat)](https://www.npmjs.com/package/babel-loader) [![Build Status](https://travis-ci.org/babel/babel-loader.svg?branch=master)](https://travis-ci.org/babel/babel-loader) [![codecov](https://codecov.io/gh/babel/babel-loader/branch/master/graph/badge.svg)](https://codecov.io/gh/babel/babel-loader)
  > Babel is a compiler for writing next generation JavaScript.

  This package allows transpiling JavaScript files using [Babel](https://github.com/babel/babel) and [webpack](https://github.com/webpack/webpack).

  __Notes:__ Issues with the output should be reported on the babel [issue tracker](https://github.com/babel/babel/issues);

## Installation

```bash
npm install babel-loader babel-core babel-preset-es2015 --save-dev
```

__Note:__ [npm](https://npmjs.com) deprecated [auto-installing of peerDependencies](https://github.com/npm/npm/issues/6565) since npm@3, so required peer dependencies like babel-core and webpack must be listed explicitly in your `package.json`.

__Note:__ If you're upgrading from babel 5 to babel 6, please take a look [at this guide](https://medium.com/@malyw/how-to-update-babel-5-x-6-x-d828c230ec53#.yqxukuzdk).

## Usage

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

  Within your webpack configuration object, you'll need to add the babel-loader to the list of modules, like so:

  ```javascript
module: {
  loaders: [
    {
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      loader: 'babel', // 'babel-loader' is also a legal name to reference
      query: {
        presets: ['es2015']
      }
    }
  ]
}
  ```

### Options

See the `babel` [options](http://babeljs.io/docs/usage/options/).

You can pass options to the loader by writing them as a [query string](https://github.com/webpack/loader-utils):

  ```javascript
module: {
  loaders: [
    {
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      loader: 'babel?presets[]=es2015'
    }
  ]
}
  ```

  or by using the query property:

  ```javascript
module: {
  loaders: [
    {
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      loader: 'babel',
      query: {
        presets: ['es2015']
      }
    }
  ]
}
  ```

  This loader also supports the following loader-specific option:

  * `cacheDirectory`: Default `false`. When set, the given directory will be used to cache the results of the loader. Future webpack builds will attempt to read from the cache to avoid needing to run the potentially expensive Babel recompilation process on each run. If the value is blank (`loader: 'babel-loader?cacheDirectory'`) the loader will use the default OS temporary file directory.

  * `cacheIdentifier`: Default is a string composed by the babel-core's version, the babel-loader's version, the contents of .babelrc file if it exists and the value of the environment variable `BABEL_ENV` with a fallback to the `NODE_ENV` environment variable. This can be set to a custom value to force cache busting if the identifier changes.


  __Note:__ The `sourceMap` option is ignored, instead sourceMaps are automatically enabled when webpack is configured to use them (via the `devtool` config option).

## Troubleshooting

### babel-loader is slow!

  Make sure you are transforming as few files as possible. Because you are probably
  matching `/\.js$/`, you might be transforming the `node_modules` folder or other unwanted
  source.

  To exclude `node_modules`, see the `exclude` option in the `loaders` config as documented above.

  You can also speed up babel-loader by as much as 2x by using the `cacheDirectory` option.
  This will cache transformations to the filesystem.

### babel is injecting helpers into each file and bloating my code!

  babel uses very small helpers for common functions such as `_extend`. By default
  this will be added to every file that requires it.

  You can instead require the babel runtime as a separate module to avoid the duplication.

  The following configuration disables automatic per-file runtime injection in babel, instead
  requiring `babel-plugin-transform-runtime` and making all helper references use it.

  See the [docs](http://babeljs.io/docs/plugins/transform-runtime/) for more information.

  **NOTE:** You must run `npm install babel-plugin-transform-runtime --save-dev` to include this in your project and `babel-runtime` itelf as a dependency with `npm install babel-runtime --save`.

```javascript
loaders: [
  // the 'transform-runtime' plugin tells babel to require the runtime
  // instead of inlining it.
  {
    test: /\.js$/,
    exclude: /(node_modules|bower_components)/,
    loader: 'babel',
    query: {
      presets: ['es2015'],
      plugins: ['transform-runtime']
    }
  }
]
```

### using `cacheDirectory` fails with ENOENT Error

If using cacheDirectory results in an error similar to the following:

```
ERROR in ./frontend/src/main.js
Module build failed: Error: ENOENT, open 'true/350c59cae6b7bce3bb58c8240147581bfdc9cccc.json.gzip'
 @ multi app
```
(notice the `true/` in the filepath)

That means that most likely, you're not setting the options correctly, and you're doing something similar to:

```javascript
loaders: [
  {
    test: /\.js$/,
    exclude: /(node_modules|bower_components)/,
    loader: 'babel?cacheDirectory=true'
  }
]
```

That's not the correct way of setting boolean values. You should do instead:

```javascript
loaders: [
  {
    test: /\.js$/,
    exclude: /(node_modules|bower_components)/,
    loader: 'babel?cacheDirectory'
  }
]
```

or use the [query](https://webpack.github.io/docs/using-loaders.html#query-parameters) property:

```javascript
loaders: [
  // the optional 'runtime' transformer tells babel to require the runtime
  // instead of inlining it.
  {
    test: /\.js$/,
    exclude: /(node_modules|bower_components)/,
    loader: 'babel',
    query: {
      cacheDirectory: true
    }
  }
]
```


### custom polyfills (e.g. Promise library)

Since Babel includes a polyfill that includes a custom [regenerator runtime](https://github.com/facebook/regenerator/blob/master/runtime.js) and [core.js](https://github.com/zloirock/core-js), the following usual shimming method using `webpack.ProvidePlugin` will not work:

```javascript
// ...
        new webpack.ProvidePlugin({
            'Promise': 'bluebird'
        }),
// ...
```

The following approach will not work either:

```javascript
require('babel-runtime/core-js/promise').default = require('bluebird');

var promise = new Promise;
```

which outputs to (using `runtime`):

```javascript
'use strict';

var _Promise = require('babel-runtime/core-js/promise')['default'];

require('babel-runtime/core-js/promise')['default'] = require('bluebird');

var promise = new _Promise();
```

The previous `Promise` library is referenced and used before it is overridden.

One approach is to have a "bootstrap" step in your application that would first override the default globals before your application:

```javascript
// bootstrap.js

require('babel-runtime/core-js/promise').default = require('bluebird');

// ...

require('./app');
```

## [License](http://couto.mit-license.org/)
