# prefix-style

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

For a camel case string like `"transform"` or `"transformStyle"`, returns the prefixed version like `"MozTransformStyle"` (if necessary). Returns `false` if the style is unsupported. 

```js
var camel = require('to-camel-case')
var prefix = require('prefix-style')

var key = prefix(camel('transform-style'))
if (key)
    element.style[key] = 'preserve-3d'
```

Original implementation by [Paul Irish](https://gist.github.com/paulirish/523692), with some modifications by me.

## Usage

[![NPM](https://nodei.co/npm/prefix-style.png)](https://nodei.co/npm/prefix-style/)

#### `prefix(prop)`

Prefixes `prop`, a camel case string like `transformStyle` or `fontSmoothing`. Returns the prefixed camel case version (or unprefixed if the browser supports it). Returns `false` if the browser doesn't support it. 

## License

Implementation by [Paul Irish](https://gist.github.com/paulirish/523692).

Redistributed under MIT, see [LICENSE.md](http://github.com/mattdesl/prefix-style/blob/master/LICENSE.md) for details.
