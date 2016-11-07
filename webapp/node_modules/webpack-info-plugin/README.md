# webpack-info-plugin

simple plugin to show webpack state & stats like [webpack-dev-middleware]

```js

// webpack.config.js

var WebpackInfoPlugin = require('webpack-info-plugin');

var info = new WebpackInfoPlugin({
  stats: { // provide false to disable displaying stats
      // pass options from http://webpack.github.io/docs/node.js-api.html#stats-tostring
      colors: true,
      version: false,
      hash: false,
      timings: true,
      assets: false,
      chunks: false,
      chunkModules: false,
      modules: false
    },
    state: true // show bundle valid / invalid
});

module.exports = {
  entry: {
    ...
  },
  output: {
    ...
  },
  plugins: [
    info
  ]
}
```

sample output:

```
webpack: bundle is now INVALID.
Time: 53ms

WARNING in ./src/util/__test__/array.test.js
Module parse failed: ...../src/util/__test__/array.test.js Line 8: Unexpected token ;
You may need an appropriate loader to handle this file type.
|     describe('#indexOf()', function () {
|         it('should return -1 when the value is not present', function () {
|             assert.equal(-1, [1,2,3].indexOf(5);
|             assert.equal(-1, [1,2,3].indexOf(0));
|         });
 @ ./src \.test$

.......


Time: 49ms
webpack: bundle is now VALID.

```


[webpack-dev-middleware]: https://github.com/webpack/webpack-dev-middleware
