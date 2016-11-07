# [postcss][postcss]-merge-longhand [![Build Status](https://travis-ci.org/ben-eb/postcss-merge-longhand.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-merge-longhand.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-merge-longhand.svg)][deps]

> Merge longhand properties into shorthand with PostCSS.

## Install

With [npm](https://npmjs.org/package/postcss-merge-longhand) do:

```
npm install postcss-merge-longhand --save
```

## Example

Merge longhand properties into shorthand; works with `margin`, `padding` &
`border`. For more examples see the [tests](src/__tests__/index.js).

### Input

```css
h1 {
    margin-top: 10px;
    margin-right: 20px;
    margin-bottom: 10px;
    margin-left: 20px;
}
```

### Output

```css
h1 {
    margin: 10px 20px;
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

[ci]:      https://travis-ci.org/ben-eb/postcss-merge-longhand
[deps]:    https://gemnasium.com/ben-eb/postcss-merge-longhand
[npm]:     http://badge.fury.io/js/postcss-merge-longhand
[postcss]: https://github.com/postcss/postcss
