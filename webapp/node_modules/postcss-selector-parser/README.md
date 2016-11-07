# postcss-selector-parser [![Build Status](https://travis-ci.org/postcss/postcss-selector-parser.svg?branch=master)](https://travis-ci.org/postcss/postcss-selector-parser)

> Selector parser with built in methods for working with selector strings.

## Install

With [npm](https://npmjs.com/package/postcss-selector-parser) do:

```
npm install postcss-selector-parser
```

## Quick Start

```js
var parser = require('postcss-selector-parser');
var transform = function (selectors) {
    selectors.eachInside(function (selector) {
        // do something with the selector
        console.log(String(selector))
    });
};

var transformed = parser(transform).process('h1, h2, h3').result;
```

To normalize selector whitespace:

```js
var parser = require('postcss-selector-parser');
var normalized = parser().process('h1, h2, h3', {lossless:false}).result;
// -> h1,h2,h3
```

## API

Please see [API.md](API.md).

## Credits

* Huge thanks to Andrey Sitnik (@ai) for work on PostCSS which helped
  accelerate this module's development.

## License

MIT
