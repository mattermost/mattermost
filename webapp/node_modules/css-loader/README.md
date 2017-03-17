# css loader for webpack

## installation

`npm install css-loader --save-dev`

## Usage

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

``` javascript
var css = require("css!./file.css");
// => returns css code from file.css, resolves imports and url(...)
```

`@import` and `url(...)` are interpreted like `require()` and will be resolved by the css-loader.
Good loaders for requiring your assets are the [file-loader](https://github.com/webpack/file-loader)
and the [url-loader](https://github.com/webpack/url-loader) which you should specify in your config (see below).

To be compatible with existing css files (if not in CSS Module mode):
* `url(image.png)` => `require("./image.png")`
* `url(~module/image.png)` => `require("module/image.png")`

### Example config

This webpack config can load css files, embed small png images as Data Urls and jpg images as files.

``` javascript
module.exports = {
  module: {
    loaders: [
      { test: /\.css$/, loader: "style-loader!css-loader" },
      { test: /\.png$/, loader: "url-loader?limit=100000" },
      { test: /\.jpg$/, loader: "file-loader" }
    ]
  }
};
```

### 'Root-relative' urls

For urls that start with a `/`, the default behavior is to not translate them:
* `url(/image.png)` => `url(/image.png)`

If a `root` query parameter is set, however, it will be prepended to the url
and then translated:

With a config like:

``` javascript
    loaders: [
      { test: /\.css$/, loader: "style-loader!css-loader?root=." },
      ...
    ]
```

The result is:

* `url(/image.png)` => `require("./image.png")`

Using 'Root-relative' urls is not recommended. You should only use it for legacy CSS files.

### Local scope

By default CSS exports all class names into a global selector scope. Styles can be locally scoped to avoid globally scoping styles.

The syntax `:local(.className)` can be used to declare `className` in the local scope. The local identifiers are exported by the module.

With `:local` (without brackets) local mode can be switched on for this selector. `:global(.className)` can be used to declare an explicit global selector. With `:global` (without brackets) global mode can be switched on for this selector.

The loader replaces local selectors with unique identifiers. The choosen unique identifiers are exported by the module.

Example:

``` css
:local(.className) { background: red; }
:local .className { color: green; }
:local(.className .subClass) { color: green; }
:local .className .subClass :global(.global-class-name) { color: blue; }
```

is transformed to

``` css
._23_aKvs-b8bW2Vg3fwHozO { background: red; }
._23_aKvs-b8bW2Vg3fwHozO { color: green; }
._23_aKvs-b8bW2Vg3fwHozO ._13LGdX8RMStbBE9w-t0gZ1 { color: green; }
._23_aKvs-b8bW2Vg3fwHozO ._13LGdX8RMStbBE9w-t0gZ1 .global-class-name { color: blue; }
```

and the identifiers are exported:

``` js
exports.locals = {
  className: "_23_aKvs-b8bW2Vg3fwHozO",
  subClass: "_13LGdX8RMStbBE9w-t0gZ1"
}
```

Camelcasing is recommended for local selectors. They are easier to use in the importing javascript module.

`url(...)` URLs in block scoped (`:local .abc`) rules behave like requests in modules:
  * `./file.png` instead of `file.png`
  * `module/file.png` instead of `~module/file.png`


You can use `:local(#someId)`, but this is not recommended. Use classes instead of ids.

You can configure the generated ident with the `localIdentName` query parameter (default `[hash:base64]`). Example: `css-loader?localIdentName=[path][name]---[local]---[hash:base64:5]` for easier debugging.

Note: For prerendering with extract-text-webpack-plugin you should use `css-loader/locals` instead of `style-loader!css-loader` **in the prerendering bundle**. It doesn't embed CSS but only exports the identifier mappings.

### CSS Modules

See [CSS Modules](https://github.com/css-modules/css-modules).

The query parameter `modules` enables the **CSS Modules** spec. (`css-loader?modules`)

This enables Local scoped CSS by default. (You can switch it off with `:global(...)` or `:global` for selectors and/or rules.)

### Composing CSS classes

When declaring a local class name you can compose a local class from another local class name.

``` css
:local(.className) {
  background: red;
  color: yellow;
}

:local(.subClass) {
  composes: className;
  background: blue;
}
```

This doesn't result in any change to the CSS itself but exports multiple class names:

``` js
exports.locals = {
  className: "_23_aKvs-b8bW2Vg3fwHozO",
  subClass: "_13LGdX8RMStbBE9w-t0gZ1 _23_aKvs-b8bW2Vg3fwHozO"
}
```

and CSS is transformed to:

``` css
._23_aKvs-b8bW2Vg3fwHozO {
  background: red;
  color: yellow;
}

._13LGdX8RMStbBE9w-t0gZ1 {
  background: blue;
}
```

### Importing local class names

To import a local class name from another module:

``` css
:local(.continueButton) {
  composes: button from "library/button.css";
  background: red;
}
```

``` css
:local(.nameEdit) {
  composes: edit highlight from "./edit.css";
  background: red;
}
```

To import from multiple modules use multiple `composes:` rules.

``` css
:local(.className) {
  composes: edit hightlight from "./edit.css";
  composes: button from "module/button.css";
  composes: classFromThisModule;
  background: red;
}
```

### SourceMaps

To include SourceMaps set the `sourceMap` query param.

`require("css-loader?sourceMap!./file.css")`

I. e. the extract-text-webpack-plugin can handle them.

They are not enabled by default because they expose a runtime overhead and increase in bundle size (JS SourceMap do not). In addition to that relative paths are buggy and you need to use an absolute public path which include the server url.

### importing and chained loaders

The query parameter `importLoaders` allow to configure which loaders should be applied to `@import`ed resources.

`importLoaders` (int): That many loaders after the css-loader are used to import resources.

Examples:

``` js
require("style-loader!css-loader?importLoaders=1!autoprefixer-loader!...")
// => imported resources are handled this way:
require("css-loader?importLoaders=1!autoprefixer-loader!...")

require("style-loader!css-loader!stylus-loader!...")
// => imported resources are handled this way:
require("css-loader!...")
```

This may change in the future, when the module system (i. e. webpack) supports loader matching by origin.

### Minification

By default the css-loader minimizes the css if specified by the module system.

In some cases the minification is destructive to the css, so you can provide some options to it. cssnano is used for minification and you find a [list of options here](http://cssnano.co/options/). Just provide them as query parameter: i. e. `require("css-loader?-autoprefixer")` to disable removing of deprecated vendor prefixes.

You can also disable or enforce minification with the `minimize` query parameter.

`require("css-loader?minimize!./file.css")` (enforced)

`require("css-loader?-minimize!./file.css")` (disabled)

### Disable behavior

`css-loader?-url` disables `url(...)` handling.

`css-loader?-import` disables `@import` handling.

### Camel case

By default, the exported JSON keys mirror the class names. If you want to camelize class names (useful in Javascript), pass the query parameter `camelCase` to the loader.

Example:

`css-loader?camelCase`

Usage:
```css
/* file.css */

.class-name { /* ... */ }
```

```js
// javascript

require('file.css').className
```

## License

MIT (http://www.opensource.org/licenses/mit-license.php)
