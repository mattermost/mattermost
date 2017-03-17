Intl Format Cache
=================

A memoizer factory for Intl format constructors.

[![npm Version][npm-badge]][npm]
[![Build Status][travis-badge]][travis]
[![Dependency Status][david-badge]][david]


Overview
--------

This is a helper package used within [Yahoo's FormatJS suite][FormatJS]. It provides a factory for creating memoizers of [`Intl`][Intl] format constructors: [`Intl.NumberFormat`][Intl-NF], [`Intl.DateTimeFormat`][Intl-DTF], [`IntlMessageFormat`][Intl-MF], and [`IntlRelativeFormat`][Intl-RF].

Creating instances of these `Intl` formats is an expensive operation, and the APIs are designed such that developers should re-use format instances instead of always creating new ones. This package is simply to make it easier to create a cache of format instances of a particular type to aid in their reuse.

Under the hood, this package creates a cache key based on the arguments passed to the memoized constructor (it will even order the keys of the `options` argument) it uses `JSON.stringify()` to create the string key. If the runtime does not have built-in or polyfilled support for `JSON`, new instances will be created each time the memoizer function is called.


Usage
-----

This package works as an ES6 or Node.js module, in either case it has a single default export function; e.g.:

```js
// In an ES6 module.
import memoizeFormatConstructor from 'intl-format-cache';
```

```js
// In Node.
var memoizeFormatConstructor = require('intl-format-cache');
```

This default export is a factory function which can be passed an `Intl` format constructor and it will return a memoizer that will create or reuse an `Intl` format instance and return it.

```js
var getNumberFormat = memoizeFormatConstructor(Intl.NumberFormat);

var nf1 = getNumberFormat('en');
var nf2 = getNumberFormat('en');
var nf3 = getNumberFormat('fr');

console.log(nf1 === nf2); // => true
console.log(nf1 === nf3); // => false

console.log(nf1.format(1000)); // => "1,000"
console.log(nf3.format(1000)); // => "1 000"
```


License
-------

This software is free to use under the Yahoo! Inc. BSD license.
See the [LICENSE file][LICENSE] for license text and copyright information.


[npm]: https://www.npmjs.org/package/intl-format-cache
[npm-badge]: https://img.shields.io/npm/v/intl-format-cache.svg?style=flat-square
[david]: https://david-dm.org/yahoo/intl-format-cache
[david-badge]: https://img.shields.io/david/yahoo/intl-format-cache.svg?style=flat-square
[travis]: https://travis-ci.org/yahoo/intl-format-cache
[travis-badge]: https://img.shields.io/travis/yahoo/intl-format-cache/master.svg?style=flat-square
[Intl]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
[Intl-NF]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/NumberFormat
[Intl-DTF]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DateTimeFormat
[Intl-MF]: https://github.com/yahoo/intl-messageformat
[Intl-RF]: https://github.com/yahoo/intl-relativeformat
[FormatJS]: http://formatjs.io/
[LICENSE]: https://github.com/yahoo/intl-format-cache/blob/master/LICENSE
