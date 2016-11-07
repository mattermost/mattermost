# [postcss][postcss]-normalize-url [![Build Status](https://travis-ci.org/ben-eb/postcss-normalize-url.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-normalize-url.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-normalize-url.svg)][deps]

> [Normalize URLs](https://github.com/sindresorhus/normalize-url) with PostCSS.

## Install

With [npm](https://npmjs.org/package/postcss-normalize-url) do:

```
npm install postcss-normalize-url --save
```

## Example

### Input

```css
h1 {
    background: url("http://site.com:80/image.jpg")
}
```

### Output

```css
h1 {
    background: url(http://site.com/image.jpg)
}
```

Note that this module will also try to normalize relative URLs, and is capable
of stripping unnecessary quotes. For more examples, see the [tests](test.js).

## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.

## API

### normalize([options])

Please see the [normalize-url documentation][docs]. By default,
`normalizeProtocol` & `stripFragment` are set to `false`; `stripWWW` to `true`.

## Contributing

Pull requests are welcome. If you add functionality, then please add unit tests
to cover it.

## License

MIT © [Ben Briggs](http://beneb.info)

[docs]: https://github.com/sindresorhus/normalize-url#options

[ci]:      https://travis-ci.org/ben-eb/postcss-normalize-url
[deps]:    https://gemnasium.com/ben-eb/postcss-normalize-url
[npm]:     http://badge.fury.io/js/postcss-normalize-url
[postcss]: https://github.com/postcss/postcss
