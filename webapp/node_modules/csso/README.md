[![NPM version](https://img.shields.io/npm/v/csso.svg)](https://www.npmjs.com/package/csso)
[![Build Status](https://travis-ci.org/css/csso.svg?branch=master)](https://travis-ci.org/css/csso)
[![Coverage Status](https://coveralls.io/repos/github/css/csso/badge.svg?branch=master)](https://coveralls.io/github/css/csso?branch=master)
[![NPM Downloads](https://img.shields.io/npm/dm/csso.svg)](https://www.npmjs.com/package/csso)
[![Twitter](https://img.shields.io/badge/Twitter-@cssoptimizer-blue.svg)](https://twitter.com/cssoptimizer)

CSSO (CSS Optimizer) is a CSS minifier. It performs three sort of transformations: cleaning (removing redundant), compression (replacement for shorter form) and restructuring (merge of declarations, rulesets and so on). As a result your CSS becomes much smaller.

[![Originated by Yandex](https://cdn.rawgit.com/css/csso/8d1b89211ac425909f735e7d5df87ee16c2feec6/docs/yandex.svg)](https://www.yandex.com/)
[![Sponsored by Avito](https://cdn.rawgit.com/css/csso/8d1b89211ac425909f735e7d5df87ee16c2feec6/docs/avito.svg)](https://www.avito.ru/)

## Usage

```
npm install -g csso
```

Or try out CSSO [right in your browser](http://css.github.io/csso/csso.html) (web interface).

### Runners

- Gulp: [gulp-csso](https://github.com/ben-eb/gulp-csso)
- Grunt: [grunt-csso](https://github.com/t32k/grunt-csso)
- Broccoli: [broccoli-csso](https://github.com/sindresorhus/broccoli-csso)
- PostCSS: [postcss-csso](https://github.com/lahmatiy/postcss-csso)
- Webpack: [csso-loader](https://github.com/sandark7/csso-loader)

### Command line

```
csso [input] [output] [options]

Options:

      --comments <value>    Comments to keep: exclamation (default), first-exclamation or none
      --debug [level]       Output intermediate state of CSS during compression
  -h, --help                Output usage information
  -i, --input <filename>    Input file
      --input-map <source>  Input source map: none, auto (default) or <filename>
  -m, --map <destination>   Generate source map: none (default), inline, file or <filename>
  -o, --output <filename>   Output file (result outputs to stdout if not set)
      --restructure-off     Turns structure minimization off
      --stat                Output statistics in stderr
  -u, --usage <filenane>    Usage data file
  -v, --version             Output version
```

Some examples:

```
> csso in.css
...output result in stdout...

> csso in.css --output out.css

> echo '.test { color: #ff0000; }' | csso
.test{color:red}

> cat source1.css source2.css | csso | gzip -9 -c > production.css.gz
```

### Source maps

Source map doesn't generate by default. To generate map use `--map` CLI option, that can be:

- `none` (default) – don't generate source map
- `inline` – add source map into result CSS (via `/*# sourceMappingURL=application/json;base64,... */`)
- `file` – write source map into file with same name as output file, but with `.map` extension (in this case `--output` option is required)
- any other values treat as filename for generated source map

Examples:

```
> csso my.css --map inline
> csso my.css --output my.min.css --map file
> csso my.css --output my.min.css --map maps/my.min.map
```

Use `--input-map` option to specify input source map if needed. Possible values for option:

- `auto` (default) - attempt to fetch input source map by follow steps:
  - try to fetch inline map from input
  - try to fetch source map filename from input and read its content
  - (when `--input` is specified) check file with same name as input file but with `.map` extension exists and read its content
- `none` - don't use input source map; actually it's using to disable `auto`-fetching
- any other values treat as filename for input source map

Generally you shouldn't care about input source map since defaults behaviour (`auto`) covers most use cases.

> NOTE: Input source map is using only if output source map is generating.

### Usage data

`CSSO` can use data about how `CSS` is using for better compression. File with this data (`JSON` format) can be set using `--usage` option. Usage data may contain follow sections:

- `tags` – white list of tags
- `ids` – white list of ids
- `classes` – white list of classes
- `scopes` – groups of classes which never used with classes from other groups on single element

All sections are optional. Value of `tags`, `ids` and `classes` should be array of strings, value of `scopes` should be an array of arrays of strings. Other values are ignoring.

#### Selector filtering

`tags`, `ids` and `classes` are using on clean stage to filter selectors that contains something that not in list. Selectors are filtering only by those kind of simple selector which white list is specified. For example, if only `tags` list is specified then type selectors are checking, and if selector hasn't any type selector (or even any type selector) it isn't filter.

> `ids` and `classes` names are case sensitive, `tags` – is not.

Input CSS:

```css
* { color: green; }
ul, ol, li { color: blue; }
UL.foo, span.bar { color: red; }
```

Usage data:

```json
{
    "tags": ["ul", "LI"]
}
```

Result CSS:

```css
*{color:green}ul,li{color:blue}ul.foo{color:red}
```

#### Scopes

Scopes is designed for CSS scope isolation solutions such as [css-modules](https://github.com/css-modules/css-modules). Scopes are similar to namespaces and defines lists of class names that exclusively used on some markup. This information allows the optimizer to move rulesets more agressive. Since it assumes selectors from different scopes can't to be matched on the same element. That leads to better ruleset merging.

Suppose we have a file:

```css
.module1-foo { color: red; }
.module1-bar { font-size: 1.5em; background: yellow; }

.module2-baz { color: red; }
.module2-qux { font-size: 1.5em; background: yellow; width: 50px; }
```

It can be assumed that first two rules never used with second two on the same markup. But we can't know that for sure without markup. The optimizer doesn't know it eather and will perform safe transformations only. The result will be the same as input but with no spaces and some semicolons:

```css
.module1-foo{color:red}.module1-bar{font-size:1.5em;background:#ff0}.module2-baz{color:red}.module2-qux{font-size:1.5em;background:#ff0;width:50px}
```

But with usage data `CSSO` can get better output. If follow usage data is provided:

```json
{
    "scopes": [
        ["module1-foo", "module1-bar"],
        ["module2-baz", "module2-qux"]
    ]
}
```

New result (29 bytes extra saving):

```css
.module1-foo,.module2-baz{color:red}.module1-bar,.module2-qux{font-size:1.5em;background:#ff0}.module2-qux{width:50px}
```

If class name doesn't specified in `scopes` it belongs to default "scope". `scopes` doesn't affect `classes`. If class name presents in `scopes` but missed in `classes` (both sections specified) it will be filtered.

Note that class name can't be specified in several scopes. Also selector can't has classes from different scopes. In both cases an exception throws.

Currently the optimizer doesn't care about out-of-bounds selectors order changing safety (i.e. selectors that may be matched to elements with no class name of scope, e.g. `.scope div` or `.scope ~ :last-child`) since assumes scoped CSS modules doesn't relay on it's order. It may be fix in future if to be an issue.

### API

```js
var csso = require('csso');

var compressedCss = csso.minify('.test { color: #ff0000; }').css;

console.log(compressedCss);
// .test{color:red}
```

You may minify CSS by yourself step by step:

```js
var ast = csso.parse('.test { color: #ff0000; }');
var compressResult = csso.compress(ast);
var compressedCss = csso.translate(compressResult.ast);

console.log(compressedCss);
// .test{color:red}
```

Working with source maps:

```js
var css = fs.readFileSync('path/to/my.css', 'utf8');
var result = csso.minify(css, {
  filename: 'path/to/my.css', // will be added to source map as reference to source file
  sourceMap: true             // generate source map
});

console.log(result);
// { css: '...minified...', map: SourceMapGenerator {} }

console.log(result.map.toString());
// '{ .. source map content .. }'
```

#### minify(source[, options])

Minify `source` CSS passed as `String`.

Options:

- sourceMap `Boolean` - generate source map if `true`
- filename `String` - filename of input, uses for source map
- debug `Boolean` - output debug information to `stderr`
- other options are the same as for `compress()`

Returns an object with properties:

- css `String` – resulting CSS
- map `Object` – instance of `SourceMapGenerator` or `null`

```js
var result = csso.minify('.test { color: #ff0000; }', {
    restructure: false,   // don't change CSS structure, i.e. don't merge declarations, rulesets etc
    debug: true           // show additional debug information:
                          // true or number from 1 to 3 (greater number - more details)
});

console.log(result.css);
// > .test{color:red}
```

#### minifyBlock(source[, options])

The same as `minify()` but for style block. Usualy it's a `style` attribute content.

```js
var result = csso.minifyBlock('color: rgba(255, 0, 0, 1); color: #ff0000').css;

console.log(result.css);
// > color:red
```

#### parse(source[, options])

Parse CSS to AST.

> NOTE: Currenly parser omit redundant separators, spaces and comments (except exclamation comments, i.e. `/*! comment */`) on AST build, since those things are removing by compressor anyway.

Options:

- context `String` – parsing context, useful when some part of CSS is parsing (see below)
- positions `Boolean` – should AST contains node position or not, store data in `info` property of nodes (`false` by default)
- filename `String` – filename of source that adds to info when `positions` is true, uses for source map generation (`<unknown>` by default)
- line `Number` – initial line number, useful when parse fragment of CSS to compute correct positions
- column `Number` – initial column number, useful when parse fragment of CSS to compute correct positions

Contexts:

- `stylesheet` (default) – regular stylesheet, should be suitable in most cases
- `atrule` – at-rule (e.g. `@media screen, print { ... }`)
- `atruleExpression` – at-rule expression (`screen, print` for example above)
- `ruleset` – rule (e.g. `.foo, .bar:hover { color: red; border: 1px solid black; }`)
- `selector` – selector group (`.foo, .bar:hover` for ruleset example)
- `simpleSelector` – selector (`.foo` or `.bar:hover` for ruleset example)
- `block` – block content w/o curly braces (`color: red; border: 1px solid black;` for ruleset example)
- `declaration` – declaration (`color: red` or `border: 1px solid black` for ruleset example)
- `value` – declaration value (`red` or `1px solid black` for ruleset example)

```js
// simple parsing with no options
var ast = csso.parse('.example { color: red }');

// parse with options
var ast = csso.parse('.foo.bar', {
    context: 'simpleSelector',
    positions: true
});
```

#### compress(ast[, options])

Does the main task – compress AST.

> NOTE: `compress` performs AST compression by transforming input AST by default (since AST cloning is expensive and needed in rare cases). Use `clone` option with truthy value in case you want to keep input AST untouched.

Options:

- restructure `Boolean` – do the structure optimisations or not (`true` by default)
- clone `Boolean` - transform a copy of input AST if `true`, useful in case of AST reuse (`false` by default)
- comments `String` or `Boolean` – specify what comments to left
    - `'exclamation'` or `true` (default) – left all exclamation comments (i.e. `/*! .. */`)
    - `'first-exclamation'` – remove every comments except first one
    - `false` – remove every comments
- usage `Object` - usage data for advanced optimisations (see [Usage data](#usage-data) for details)
- logger `Function` - function to track every step of transformations

#### clone(ast)

Make an AST node deep copy.

```js
var orig = csso.parse('.test { color: red }');
var copy = csso.clone(orig);

csso.walk(copy, function(node) {
    if (node.type === 'Class') {
        node.name = 'replaced';
    }
});

console.log(csso.translate(orig));
// .test{color:red}
console.log(csso.translate(copy));
// .replaced{color:red}
```

#### translate(ast)

Converts AST to string.

```js
var ast = csso.parse('.test { color: red }');
console.log(csso.translate(ast));
// > .test{color:red}
```

#### translateWithSourceMap(ast)

The same as `translate()` but also generates source map (nodes should contain positions in `info` property).

```js
var ast = csso.parse('.test { color: red }', {
    filename: 'my.css',
    positions: true
});
console.log(csso.translateWithSourceMap(ast));
// { css: '.test{color:red}', map: SourceMapGenerator {} }
```

#### walk(ast, handler)

Visit all nodes of AST and call handler for each one. `handler` receives three arguments:

- node – current AST node
- item – node wrapper when node is a list member; this wrapper contains references to `prev` and `next` nodes in list
- list – reference to list when node is a list member; it's useful for operations on list like `remove()` or `insert()`

Context for handler an object, that contains references to some parent nodes:

- root – refers to `ast` or root node
- stylesheet – refers to closest `StyleSheet` node, it may be a top-level or at-rule block stylesheet
- atruleExpression – refers to `AtruleExpression` node if current node inside at-rule expression
- ruleset – refers to `Ruleset` node if current node inside a ruleset
- selector – refers to `Selector` node if current node inside a selector
- declaration – refers to `Declaration` node if current node inside a declaration
- function – refers to closest `Function` or `FunctionalPseudo` node if current node inside one of them

```js
// collect all urls in declarations
var csso = require('./lib/index.js');
var urls = [];
var ast = csso.parse(`
  @import url(import.css);
  .foo { background: url('foo.jpg'); }
  .bar { background-image: url(bar.png); }
`);

csso.walk(ast, function(node) {
    if (this.declaration !== null && node.type === 'Url') {
        var value = node.value;

        if (value.type === 'Raw') {
            urls.push(value.value);
        } else {
            urls.push(value.value.substr(1, value.value.length - 2));
        }
    }
});

console.log(urls);
// [ 'foo.jpg', 'bar.png' ]
```

#### walkRules(ast, handler)

Same as `walk()` but visits `Ruleset` and `Atrule` nodes only.

#### walkRulesRight(ast, handler)

Same as `walkRules()` but visits nodes in reverse order (from last to first).

## More reading

- [Debugging](docs/debugging.md)

## License

MIT
