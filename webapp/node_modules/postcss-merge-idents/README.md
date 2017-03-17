# [postcss][postcss]-merge-idents [![Build Status](https://travis-ci.org/ben-eb/postcss-merge-idents.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-merge-idents.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-merge-idents.svg)][deps]

> Merge keyframe and counter style identifiers.


## Install

With [npm](https://npmjs.org/package/postcss-merge-idents) do:

```
npm install postcss-merge-idents --save
```


## Example

This module will merge identifiers such as `@keyframes` and `@counter-style`,
if their properties are identical. Then, it will update those declarations that
depend on the duplicated property.

### Input

```css
@keyframes rotate {
    from { transform: rotate(0) }
    to { transform: rotate(360deg) }
}

@keyframes flip {
    from { transform: rotate(0) }
    to { transform: rotate(360deg) }
}

.rotate {
    animation-name: rotate
}

.flip {
    animation-name: flip
}
```

### Output

```css
@keyframes flip {
    from { transform: rotate(0) }
    to { transform: rotate(360deg) }
}

.rotate {
    animation-name: flip
}

.flip {
    animation-name: flip
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


[ci]:      https://travis-ci.org/ben-eb/postcss-merge-idents
[deps]:    https://gemnasium.com/ben-eb/postcss-merge-idents
[npm]:     http://badge.fury.io/js/postcss-merge-idents
[postcss]: https://github.com/postcss/postcss
