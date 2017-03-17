# HTMLMinifier

[![NPM version](https://img.shields.io/npm/v/html-minifier.svg)](https://www.npmjs.com/package/html-minifier)
[![Build Status](https://img.shields.io/travis/kangax/html-minifier.svg)](https://travis-ci.org/kangax/html-minifier)
[![Dependency Status](https://img.shields.io/david/kangax/html-minifier.svg)](https://david-dm.org/kangax/html-minifier)
[![devDependency Status](https://img.shields.io/david/dev/kangax/html-minifier.svg)](https://david-dm.org/kangax/html-minifier?type=dev)
[![Gitter](https://img.shields.io/gitter/room/kangax/html-minifier.svg)](https://gitter.im/kangax/html-minifier)

[HTMLMinifier](http://kangax.github.io/html-minifier/) is a highly **configurable**, **well-tested**, JavaScript-based HTML minifier.

See [corresponding blog post](http://perfectionkills.com/experimenting-with-html-minifier/) for all the gory details of [how it works](http://perfectionkills.com/experimenting-with-html-minifier/#how_it_works), [description of each option](http://perfectionkills.com/experimenting-with-html-minifier/#options), [testing results](http://perfectionkills.com/experimenting-with-html-minifier/#field_testing) and [conclusions](http://perfectionkills.com/experimenting-with-html-minifier/#cost_and_benefits).

[Test suite is available online](http://kangax.github.io/html-minifier/tests/).

Also see corresponding [Ruby wrapper](https://github.com/stereobooster/html_minifier), and for Node.js, [Grunt plugin](https://github.com/gruntjs/grunt-contrib-htmlmin), [Gulp module](https://github.com/jonschlinkert/gulp-htmlmin), [Koa middleware wrapper](https://github.com/koajs/html-minifier) and [Express middleware wrapper](https://github.com/melonmanchan/express-minify-html).

For lint-like capabilities take a look at [HTMLLint](https://github.com/kangax/html-lint).

## Minification comparison

How does HTMLMinifier compare to other solutions — [HTML Minifier from Will Peavy](http://www.willpeavy.com/minifier/) (1st result in [Google search for "html minifier"](https://www.google.com/#q=html+minifier)) as well as [htmlcompressor.com](http://htmlcompressor.com) and [minimize](https://github.com/Swaagie/minimize)?

| Site                                                                        | Original size *(KB)* | HTMLMinifier | minimize | Will Peavy | htmlcompressor.com |
| --------------------------------------------------------------------------- |:--------------------:| ------------:| --------:| ----------:| ------------------:|
| [Google](https://www.google.com/)                                           | 44                   | **42**       | 44       | 45         | 44                 |
| [HTMLMinifier](https://github.com/kangax/html-minifier)                     | 120                  | **81**       | 102      | 106        | 102                |
| [CNN](http://www.cnn.com/)                                                  | 133                  | **121**      | 129      | 130        | 125                |
| [Amazon](http://www.amazon.co.uk/)                                          | 171                  | **139**      | 163      | 166        | n/a                |
| [BBC](http://www.bbc.co.uk/)                                                | 178                  | **145**      | 171      | 174        | 166                |
| [New York Times](http://www.nytimes.com/)                                   | 195                  | **129**      | 144      | 146        | 138                |
| [Stack Overflow](http://stackoverflow.com/)                                 | 242                  | **186**      | 196      | 204        | 193                |
| [Bootstrap CSS](http://getbootstrap.com/css/)                               | 276                  | **264**      | 273      | 231        | 274                |
| [Wikipedia](https://en.wikipedia.org/wiki/President_of_the_United_States)   | 493                  | **449**      | 477      | 491        | n/a                |
| [NBC](http://www.nbc.com/)                                                  | 551                  | **529**      | 549      | 551        | n/a                |
| [Eloquent Javascript](http://eloquentjavascript.net/1st_edition/print.html) | 870                  | **815**      | 840      | n/a        | n/a                |
| [ES6 table](http://kangax.github.io/compat-table/es6/)                      | 4204                 | **3541**     | 3966     | n/a        | n/a                |
| [ES6 draft](https://tc39.github.io/ecma262/)                                | 4873                 | **4329**     | 4459     | n/a        | n/a                |

## Options Quick Reference

| Option                         | Description     | Default |
|--------------------------------|-----------------|---------|
| `caseSensitive`                | Treat attributes in case sensitive manner (useful for custom HTML tags) | `false` |
| `collapseBooleanAttributes`    | [Omit attribute values from boolean attributes](http://perfectionkills.com/experimenting-with-html-minifier/#collapse_boolean_attributes) | `false` |
| `collapseInlineTagWhitespace`  | Don't leave any spaces between `display:inline;` elements when collapsing. Must be used in conjunction with `collapseWhitespace=true` | `false` |
| `collapseWhitespace`           | [Collapse white space that contributes to text nodes in a document tree](http://perfectionkills.com/experimenting-with-html-minifier/#collapse_whitespace) | `false` |
| `conservativeCollapse`         | Always collapse to 1 space (never remove it entirely). Must be used in conjunction with `collapseWhitespace=true` | `false` |
| `customAttrAssign`             | Arrays of regex'es that allow to support custom attribute assign expressions (e.g. `'<div flex?="{{mode != cover}}"></div>'`) | `[ ]` |
| `customAttrCollapse`           | Regex that specifies custom attribute to strip newlines from (e.g. `/ng-class/`) | |
| `customAttrSurround`           | Arrays of regex'es that allow to support custom attribute surround expressions (e.g. `<input {{#if value}}checked="checked"{{/if}}>`) | `[ ]` |
| `customEventAttributes`        | Arrays of regex'es that allow to support custom event attributes for `minifyJS` (e.g. `ng-click`) | `[ /^on[a-z]{3,}$/ ]` |
| `decodeEntities`               | Use direct Unicode characters whenever possible | `false` |
| `html5`                        | Parse input according to HTML5 specifications | `true` |
| `ignoreCustomComments`         | Array of regex'es that allow to ignore certain comments, when matched | `[ /^!/ ]` |
| `ignoreCustomFragments`        | Array of regex'es that allow to ignore certain fragments, when matched (e.g. `<?php ... ?>`, `{{ ... }}`, etc.)  | `[ /<%[\s\S]*?%>/, /<\?[\s\S]*?\?>/ ]` |
| `includeAutoGeneratedTags`     | Insert tags generated by HTML parser | `true` |
| `keepClosingSlash`             | Keep the trailing slash on singleton elements | `false` |
| `maxLineLength`                | Specify a maximum line length. Compressed output will be split by newlines at valid HTML split-points |
| `minifyCSS`                    | Minify CSS in style elements and style attributes (uses [clean-css](https://github.com/jakubpawlowicz/clean-css)). `advanced` optimisations are disabled by default | `false` (could be `true`, `Object`, `Function(text)`) |
| `minifyJS`                     | Minify JavaScript in script elements and event attributes (uses [UglifyJS](https://github.com/mishoo/UglifyJS2)) | `false` (could be `true`, `Object`, `Function(text, inline)`) |
| `minifyURLs`                   | Minify URLs in various attributes (uses [relateurl](https://github.com/stevenvachon/relateurl)) | `false` (could be `String`, `Object`, `Function(text)`) |
| `preserveLineBreaks`           | Always collapse to 1 line break (never remove it entirely) when whitespace between tags include a line break. Must be used in conjunction with `collapseWhitespace=true` | `false` |
| `preventAttributesEscaping`    | Prevents the escaping of the values of attributes | `false` |
| `processConditionalComments`   | Process contents of conditional comments through minifier | `false` |
| `processScripts`               | Array of strings corresponding to types of script elements to process through minifier (e.g. `text/ng-template`, `text/x-handlebars-template`, etc.) | `[ ]` |
| `quoteCharacter`               | Type of quote to use for attribute values (' or ") | |
| `removeAttributeQuotes`        | [Remove quotes around attributes when possible](http://perfectionkills.com/experimenting-with-html-minifier/#remove_attribute_quotes) | `false` |
| `removeComments`               | [Strip HTML comments](http://perfectionkills.com/experimenting-with-html-minifier/#remove_comments) | `false` |
| `removeEmptyAttributes`        | [Remove all attributes with whitespace-only values](http://perfectionkills.com/experimenting-with-html-minifier/#remove_empty_or_blank_attributes) | `false` |
| `removeEmptyElements`          | [Remove all elements with empty contents](http://perfectionkills.com/experimenting-with-html-minifier/#remove_empty_elements) | `false` |
| `removeOptionalTags`           | [Remove optional tags](http://perfectionkills.com/experimenting-with-html-minifier/#remove_optional_tags) | `false` |
| `removeRedundantAttributes`    | [Remove attributes when value matches default.](http://perfectionkills.com/experimenting-with-html-minifier/#remove_redundant_attributes) | `false` |
| `removeScriptTypeAttributes`   | Remove `type="text/javascript"` from `script` tags. Other `type` attribute values are left intact | `false` |
| `removeStyleLinkTypeAttributes`| Remove `type="text/css"` from `style` and `link` tags. Other `type` attribute values are left intact | `false` |
| `removeTagWhitespace`          | Remove space between attributes whenever possible. **Note that this will result in invalid HTML!** | `false` |
| `sortAttributes`               | [Sort attributes by frequency](#sorting-attributes--style-classes) | `false` |
| `sortClassName`                | [Sort style classes by frequency](#sorting-attributes--style-classes) | `false` |
| `trimCustomFragments`          | Trim white space around `ignoreCustomFragments`. | `false` |
| `useShortDoctype`              | [Replaces the `doctype` with the short (HTML5) doctype](http://perfectionkills.com/experimenting-with-html-minifier/#use_short_doctype) | `false` |

### Sorting attributes / style classes

Minifier options like `sortAttributes` and `sortClassName` won't impact the plain-text size of the output. However, they form long repetitive chains of characters that should improve compression ratio of gzip used in HTTP compression.

## Special cases

### Ignoring chunks of markup

If you have chunks of markup you would like preserved, you can wrap them `<!-- htmlmin:ignore -->`.

### Preserving SVG tags

SVG tags are automatically recognized, and when they are minified, both case-sensitivity and closing-slashes are preserved, regardless of the minification settings used for the rest of the file.

### Working with invalid markup

HTMLMinifier **can't work with invalid or partial chunks of markup**. This is because it parses markup into a tree structure, then modifies it (removing anything that was specified for removal, ignoring anything that was specified to be ignored, etc.), then it creates a markup out of that tree and returns it.

Input markup (e.g. `<p id="">foo`)

↓

Internal representation of markup in a form of tree (e.g. `{ tag: "p", attr: "id", children: ["foo"] }`)

↓

Transformation of internal representation (e.g. removal of `id` attribute)

↓

Output of resulting markup (e.g. `<p>foo</p>`)

HTMLMinifier can't know that original markup was only half of the tree; it does its best to try to parse it as a full tree and it loses information about tree being malformed or partial in the beginning. As a result, it can't create a partial/malformed tree at the time of the output.

## Installation Instructions

From NPM for use as a command line app:

```shell
npm install html-minifier -g
```

From NPM for programmatic use:

```shell
npm install html-minifier
```

From Git:

```shell
git clone git://github.com/kangax/html-minifier.git
cd html-minifier
npm link .
```

## Usage

For command line usage please see `html-minifier --help`

### Node.js

```js
var minify = require('html-minifier').minify;
var result = minify('<p title="blah" id="moo">foo</p>', {
  removeAttributeQuotes: true
});
result; // '<p title=blah id=moo>foo</p>'
```

## Running benchmarks

Benchmarks for minified HTML:

```shell
node benchmark.js
```
