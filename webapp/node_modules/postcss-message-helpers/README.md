# postcss-message-helpers [![Build Status](https://travis-ci.org/MoOx/postcss-message-helpers.png)](https://travis-ci.org/MoOx/postcss-message-helpers)

> [PostCSS](https://github.com/postcss/postcss) helpers to throw or output GNU style messages.

This modules offers you some function to throw or just output messages with [GNU style](https://www.gnu.org/prep/standards/html_node/Errors.html): `sourcefile:lineno:column: message`

## Installation

```console
$ npm install postcss-message-helpers
```

```js
var messageHelpers = require("postcss-message-helpers")
```

## Usage

### `var fnValue = messageHelpers.try(fn, source)`

Execute `fn` an return the value.
If an exception is thrown during the process, the exception will be catched, enhanced from source & re-throw.

### `var sourceMessage = messageHelpers.message(message, source)`

Returns a message like `sourcefile:lineno:column: message`.  
`source` should be a postcss source object from a node.

### `var source = messageHelpers.source(source)`

Returns `sourcefile:lineno:column` for a given `source` postcss object.

### Example

```js
// dependencies
var fs = require("fs")
var postcss = require("postcss")
var messageHelpers = require("postcss-message-helpers")

// css to be processed
var css = fs.readFileSync("input.css", "utf8")

// process css
var output = postcss()
  .use(function(styles) {
    styles.eachDecl(function transformDecl(decl) {
      // will catch, adjust error stack, line, column & message (gnu style) then re-throw
      messageHelpers.try(function IwillThrow() {
        if (decl.value.indexOf("error(") > -1) {
          throw new Error("error detected: " + decl.value)
        }
      }, decl.source)

      // will output a gnu style warning
      if (decl.value.indexOf("warning(") > -1) {
        console.warning(messageHelpers.message("warning: " + decl.value, decl.source))
      }
    })
  })
  .process(css)
  .css
```

Checkout [tests](test) for more examples.

---

## Contributing

Work on a branch, install dev-dependencies, respect coding style & run tests before submitting a bug fix or a feature.

    $ git clone https://github.com/MoOx/postcss-message-helpers.git
    $ git checkout -b patch-1
    $ npm install
    $ npm test

## [Changelog](CHANGELOG.md)

## [License](LICENSE)
