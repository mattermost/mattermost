# es6-templates

Compiles JavaScript written using template strings to use ES5-compatible
syntax. For example, this:

```js
var name = "Nicholas",
    msg = `Hello, ${name}!`;

console.log(msg);    // "Hello, Nicholas!"
```

compiles to this:

```js
var name = "Nicholas",
    msg = "Hello, " + name + "!";

console.log(msg);    // "Hello, Nicholas!"
```

For more information about the proposed syntax, see the [TC39 wiki page on
template strings](http://tc39wiki.calculist.org/es6/template-strings/).

## Install

```
$ npm install es6-templates
```

## Usage

```js
$ node
> var compile = require('es6-templates').compile;
> compile('`Hey, ${name}!`')
{ 'code': ..., 'map': ... }
```

Without interpolation:

```js
`Hey!`
// becomes
'"Hey!"'
```

With interpolation:

```js
`Hey, ${name}!`
// becomes
"Hey, " + name + "!"
```

With a tag expression:

```js
escape `<a href="${href}">${text}</a>`
// becomes
escape(function() {
  var strings = ["\u003Ca href=\"", "\"\u003E", "\u003C/a\u003E"];
  strings.raw = ["\u003Ca href=\"", "\"\u003E", "\u003C/a\u003E"];
  return strings;
}(), href, text);
```

Or work directly with the AST:

```js
$ node
> var transform = require('es6-templates').transform;
> transform(inputAST)
```

Transforming ASTs is best done using [recast][recast] to preserve formatting
where possible and for generating source maps.

## Browserify

Browserify support is built in.

```
$ npm install es6-templates  # install local dependency
$ browserify -t es6-templates $file
```

## Contributing

[![Build Status](https://travis-ci.org/esnext/es6-templates.svg?branch=master)](https://travis-ci.org/esnext/es6-templates)

### Setup

First, install the development dependencies:

```
$ npm install
```

Then, try running the tests:

```
$ npm test
```

### Pull Requests

1. Fork it
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create new Pull Request

Any contributors to the master es6-templates repository must sign the
[Individual Contributor License Agreement (CLA)][cla].  It's a short form that
covers our bases and makes sure you're eligible to contribute.

[cla]: https://spreadsheets.google.com/spreadsheet/viewform?formkey=dDViT2xzUHAwRkI3X3k5Z0lQM091OGc6MQ&ndplr=1

When you have a change you'd like to see in the master repository, [send a pull
request](https://github.com/esnext/es6-templates/pulls). Before we merge
your request, we'll make sure you're in the list of people who have signed a
CLA.

[recast]: https://github.com/benjamn/recast
