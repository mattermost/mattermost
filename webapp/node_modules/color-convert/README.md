# color-convert [![Build Status](https://travis-ci.org/harthur/color-convert.svg?branch=master)](https://travis-ci.org/harthur/color-convert)
Color-convert is a color conversion library for JavaScript and node. It converts all ways between `rgb`, `hsl`, `hsv`, `hwb`, `cmyk`, and CSS keywords:

```js
var converter = require("color-convert")();

converter.rgb(140, 200, 100).hsl()   // [96, 48, 59]

converter.keyword("blue").rgb()      // [0, 0, 255]
```

# Install

```console
npm install color-convert
```

# API

Color-convert exports a converter object with getter/setter methods for each color space. It caches conversions:

```js
var converter = require("color-convert")();

converter.rgb(140, 200, 100).hsl()   // [96, 48, 59]

converter.rgb([140, 200, 100])       // args can be an array
```

### Plain functions
Get direct conversion functions with no fancy objects:

```js
require("color-convert").rgb2hsl([140, 200, 100]);   // [96, 48, 59]
```

### Unrounded
To get the unrounded conversion, append `Raw` to the function name:

```js
convert.rgb2hslRaw([140, 200, 100]);   // [95.99999999999999, 47.619047619047606, 58.82352941176471]
```

### Hash
There's also a hash of the conversion functions keyed first by the "from" color space, then by the "to" color space:

```js
convert["hsl"]["hsv"]([160, 0, 20]) == convert.hsl2hsv([160, 0, 20])
```

### Other spaces

There are some conversions from rgb (sRGB) to XYZ and LAB too, available as `rgb2xyz()`, `rgb2lab()`, `xyz2rgb()`, and `xyz2lab()`.

# Contribute

Please fork, add conversions, figure out color profile stuff for XYZ, LAB, etc. This is meant to be a basic library that can be used by other libraries to wrap color calculations in some cool way.
