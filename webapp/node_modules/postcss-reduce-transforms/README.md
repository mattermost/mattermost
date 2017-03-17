# [postcss][postcss]-reduce-transforms [![Build Status](https://travis-ci.org/ben-eb/postcss-reduce-transforms.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-reduce-transforms.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-reduce-transforms.svg)][deps]

> Reduce transform functions with PostCSS.

## Install

With [npm](https://npmjs.org/package/postcss-reduce-transforms) do:

```
npm install postcss-reduce-transforms --save
```

## Example

This module will reduce transform functions where possible. For more examples,
see the [tests](src/__tests__/index.js).

### Input

```css
h1 {
    transform: rotate3d(0, 0, 1, 20deg);
}
```

### Output

```css
h1 {
    transform: rotate(20deg);
}
```

## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.

## Contributing

Pull requests are welcome. If you add functionality, then please add unit tests
to cover it.

## License

MIT © [Ben Briggs](http://beneb.info)

[ci]:      https://travis-ci.org/ben-eb/postcss-reduce-transforms
[deps]:    https://gemnasium.com/ben-eb/postcss-reduce-transforms
[npm]:     http://badge.fury.io/js/postcss-reduce-transforms
[postcss]: https://github.com/postcss/postcss
