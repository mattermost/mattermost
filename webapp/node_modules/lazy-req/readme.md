# lazy-req [![Build Status](https://travis-ci.org/sindresorhus/lazy-req.svg?branch=master)](https://travis-ci.org/sindresorhus/lazy-req)

> Require modules lazily


## Install

```
$ npm install --save lazy-req
```


## Usage

```js
// pass in `require` or a custom require function
var lazyReq = require('lazy-req')(require);
var _ = lazyReq('lodash');

// where you would normally do
_.isNumber(2);

// you now instead call it as a function
_().isNumber(2);

// it's cached on consecutive calls
_().isString('unicorn');

// extract lazy variations of the props you need
var members = lazyReq('lodash')('isNumber', 'isString');

// useful when using destructuring assignment in ES2015
const { isNumber, isString } = lazyReq('lodash')('isNumber', 'isString');

// works out of the box for functions and regular properties
var stuff = lazyReq('./math-lib')('sum', 'PHI');
console.log(stuff.sum(1, 2)); // => 3
console.log(stuff.PHI); // => 1.618033
```


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
