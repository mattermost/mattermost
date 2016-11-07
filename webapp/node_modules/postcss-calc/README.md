# postcss-calc [![Build Status](https://travis-ci.org/postcss/postcss-calc.png)](https://travis-ci.org/postcss/postcss-calc)

> [PostCSS](https://github.com/postcss/postcss) plugin to reduce `calc()`.

This plugin reduce `calc()` references whenever it's possible.
This can be particularly useful with the [postcss-custom-properties](https://github.com/postcss/postcss-custom-properties) plugin.

**Note:** When multiple units are mixed together in the same expression, the `calc()` statement is left as is, to fallback to the [w3c calc() feature](http://www.w3.org/TR/css3-values/#calc).

## Installation

```console
$ npm install postcss-calc
```

## Usage

```js
// dependencies
var fs = require("fs")
var postcss = require("postcss")
var calc = require("postcss-calc")

// css to be processed
var css = fs.readFileSync("input.css", "utf8")

// process css
var output = postcss()
  .use(calc())
  .process(css)
  .css
```

**Example** (with [postcss-custom-properties](https://github.com/postcss/postcss-custom-properties) enabled as well):

```js
// dependencies
var fs = require("fs")
var postcss = require("postcss")
var customProperties = require("postcss-custom-properties")
var calc = require("postcss-calc")

// css to be processed
var css = fs.readFileSync("input.css", "utf8")

// process css
var output = postcss()
  .use(customProperties())
  .use(calc())
  .process(css)
  .css
```

Using this `input.css`:

```css
:root {
  --main-font-size: 16px;
}

body {
  font-size: var(--main-font-size);
}

h1 {
  font-size: calc(var(--main-font-size) * 2);
  height: calc(100px - 2em);
  margin-bottom: calc(
      var(--main-font-size)
      * 1.5
    )
}
```

you will get:

```css
body {
  font-size: 16px
}

h1 {
  font-size: 32px;
  height: calc(100px - 2em);
  margin-bottom: 24px
}
```

Checkout [tests](test) for more examples.

### Options

#### `precision` (default: `5`)

Allow you to definine the precision for decimal numbers.

```js
var out = postcss()
  .use(calc({precision: 10}))
  .process(css)
  .css
```

#### `preserve` (default: `false`)

Allow you to preserve calc() usage in output so browsers will handle decimal precision themselves.

```js
var out = postcss()
  .use(calc({preserve: true}))
  .process(css)
  .css
```

#### `warnWhenCannotResolve` (default: `false`)

Adds warnings when calc() are not reduced to a single value.

```js
var out = postcss()
  .use(calc({warnWhenCannotResolve: true}))
  .process(css)
  .css
```

#### `mediaQueries` (default: `false`)

Allows calc() usage as part of media query declarations.

```js
var out = postcss()
  .use(calc({mediaQueries: true}))
  .process(css)
  .css
```

#### `selectors` (default: `false`)

Allows calc() usage as part of selectors.

```js
var out = postcss()
  .use(calc({selectors: true}))
  .process(css)
  .css
```

Example:

```css
div[data-size="calc(3*3)"] {
  width: 100px;
}
```

---

## Contributing

Work on a branch, install dev-dependencies, respect coding style & run tests before submitting a bug fix or a feature.

```console
$ git clone https://github.com/postcss/postcss-calc.git
$ git checkout -b patch-1
$ npm install
$ npm test
```

## [Changelog](CHANGELOG.md)

## [License](LICENSE)
