# [postcss][postcss]-minify-selectors [![Build Status](https://travis-ci.org/ben-eb/postcss-minify-selectors.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-minify-selectors.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-minify-selectors.svg)][deps]

> Minify selectors with PostCSS.

## Install

With [npm](https://www.npmjs.com/package/postcss-minify-selectors) do:

```
npm install postcss-minify-selectors --save
```

## Example

### Input

```css
h1 + p, h2, h3, h2{color:blue}
```

### Output

```css
h1+p,h2,h3{color:blue}
```

For more examples see the [tests](test.js).

## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.

## Contributing

Pull requests are welcome. If you add functionality, then please add unit tests
to cover it.

## License

MIT © [Ben Briggs](http://beneb.info)

[ci]:      https://travis-ci.org/ben-eb/postcss-minify-selectors
[deps]:    https://gemnasium.com/ben-eb/postcss-minify-selectors
[npm]:     http://badge.fury.io/js/postcss-minify-selectors
[postcss]: https://github.com/postcss/postcss
