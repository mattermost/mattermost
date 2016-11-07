# [postcss][postcss]-discard-empty [![Build Status](https://travis-ci.org/ben-eb/postcss-discard-empty.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-discard-empty.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-discard-empty.svg)][deps]

> Discard empty rules and values with PostCSS.

## Install

With [npm](https://npmjs.org/package/postcss-discard-empty) do:

```
npm install postcss-discard-empty --save
```

## Example

For more examples see the [tests](test.js).

### Input

```css
@font-face;
h1 {}
{color:blue}
h2 {color:}
h3 {color:red}
```

### Output

```css
h3 {color:red}
```

## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.

## Contributing

Pull requests are welcome. If you add functionality, then please add unit tests
to cover it.

## License

MIT © [Ben Briggs](http://beneb.info)

[ci]:      https://travis-ci.org/ben-eb/postcss-discard-empty
[deps]:    https://gemnasium.com/ben-eb/postcss-discard-empty
[npm]:     http://badge.fury.io/js/postcss-discard-empty
[postcss]: https://github.com/postcss/postcss
