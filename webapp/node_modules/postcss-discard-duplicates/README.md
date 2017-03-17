# [postcss][postcss]-discard-duplicates [![Build Status](https://travis-ci.org/ben-eb/postcss-discard-duplicates.svg?branch=master)][ci] [![NPM version](https://badge.fury.io/js/postcss-discard-duplicates.svg)][npm] [![Dependency Status](https://gemnasium.com/ben-eb/postcss-discard-duplicates.svg)][deps]

> Discard duplicate rules in your CSS files with PostCSS.

## Install

With [npm](https://npmjs.org/package/postcss-discard-duplicates) do:

```
npm install postcss-discard-duplicates --save
```

## Example

This module will remove all duplicate rules from your stylesheets. It works on
at rules, normal rules and declarations. Note that this module does not have any
responsibility for normalising declarations, selectors or whitespace, so that it
considers these two rules to be different:

```css
h1, h2 {
    color: blue;
}

h2, h1 {
    color: blue;
}
```

It has to assume that your rules have already been transformed by another
processor, otherwise it would be responsible for too many things.

### Input

```css
h1 {
    margin: 0 auto;
    margin: 0 auto
}

h1 {
    margin: 0 auto
}
```

### Output

```css
h1 {
    margin: 0 auto
}
```

## Usage

See the [PostCSS documentation](https://github.com/postcss/postcss#usage) for
examples for your environment.

## Contributing

Pull requests are welcome. If you add functionality, then please add unit tests
to cover it.

## License

MIT © Ben Briggs

[ci]:      https://travis-ci.org/ben-eb/postcss-discard-duplicates
[deps]:    https://gemnasium.com/ben-eb/postcss-discard-duplicates
[npm]:     http://badge.fury.io/js/postcss-discard-duplicates
[postcss]: https://github.com/postcss/postcss
