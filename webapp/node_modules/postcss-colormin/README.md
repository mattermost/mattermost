# [postcss][postcss]-colormin [![Build Status](https://travis-ci.org/ben-eb/postcss-colormin.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-colormin.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-colormin.svg)][deps]

> Minify colors in your CSS files with PostCSS.

## Install

With [npm](https://npmjs.org/package/postcss-colormin) do:

```
npm install postcss-colormin --save
```


## Example

```js
var postcss = require('postcss')
var colormin = require('postcss-colormin');

var css = 'h1 {color: rgba(255, 0, 0, 1)}';
console.log(postcss(colormin()).process(css).css);

// => 'h1 {color:red}'
```

For more examples see the [tests](src/__tests__/index.js).


## API

### colormin([options])

#### options

##### legacy

Type: `boolean`  
Default: `false`

Set this to `true` to enable IE < 10 compatibility; the browser chokes on the
`transparent` keyword, so in this mode the conversion from `rgba(0,0,0,0)`
is turned off.


## Contributing

Pull requests are welcome. If you add functionality, then please add unit tests
to cover it.


## License

MIT © [Ben Briggs](http://beneb.info)


[ci]:       https://travis-ci.org/ben-eb/postcss-colormin
[deps]:     https://gemnasium.com/ben-eb/postcss-colormin
[npm]:      http://badge.fury.io/js/postcss-colormin
[postcss]:  https://github.com/postcss/postcss
