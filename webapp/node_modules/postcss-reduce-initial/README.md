# [postcss][postcss]-reduce-initial [![Build Status](https://travis-ci.org/ben-eb/postcss-reduce-initial.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-reduce-initial.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-reduce-initial.svg)][deps]

> Reduce `initial` definitions to the *actual* initial value, where possible.


## Install

With [npm](https://npmjs.org/package/postcss-reduce-initial) do:

```
npm install postcss-reduce-initial --save
```


## Example

This module will replace the `initial` CSS keyword with the *actual* value,
when this value is smaller than the `initial` definition itself. For example,
the initial value for the `min-width` property is `0`; therefore, these two
definitions are equivalent;

### Input

```css
h1 {
    min-width: initial;
}
```

### Output

```css
h1 {
    min-width: 0;
}
```

See the [data](data/values.json) for more conversions. This data is courtesy
of Mozilla.


## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.


## Contributing

Pull requests are welcome. If you add functionality, then please add unit tests
to cover it.


## License

[Template:CSSData] by Mozilla Contributors is licensed under [CC-BY-SA 2.5].

[Template:CSSData]: https://developer.mozilla.org/en-US/docs/Template:CSSData
[CC-BY-SA 2.5]: http://creativecommons.org/licenses/by-sa/2.5/

MIT © [Ben Briggs](http://beneb.info)

[ci]:      https://travis-ci.org/ben-eb/postcss-reduce-initial
[deps]:    https://gemnasium.com/ben-eb/postcss-reduce-initial
[npm]:     http://badge.fury.io/js/postcss-reduce-initial
[postcss]: https://github.com/postcss/postcss
