# [postcss][postcss]-unique-selectors [![Build Status](https://travis-ci.org/ben-eb/postcss-unique-selectors.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-unique-selectors.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-unique-selectors.svg)][deps]

> Ensure CSS selectors are unique.

## Install

With [npm](https://npmjs.org/package/postcss-unique-selectors) do:

```
npm install postcss-unique-selectors --save
```

## Example

Selectors are sorted naturally, and deduplicated:

### Input

```css
h1,h3,h2,h1 {
    color: red
}
```

### Output

```css
h1,h2,h3 {
    color: red
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

[ci]:      https://travis-ci.org/ben-eb/postcss-unique-selectors
[deps]:    https://gemnasium.com/ben-eb/postcss-unique-selectors
[npm]:     http://badge.fury.io/js/postcss-unique-selectors
[postcss]: https://github.com/postcss/postcss
