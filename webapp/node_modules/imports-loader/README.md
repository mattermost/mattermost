# imports loader for webpack

Can be used to inject variables into the scope of a module. This is especially useful if third-party modules are relying on global variables like `$` or `this` being the `window` object.

## Installation

```
npm install imports-loader
```

## Usage

Given you have this file `example.js`

```javascript
$("img").doSomeAwesomeJqueryPluginStuff();
```

then you can inject the `$` variable into the module by configuring the imports-loader like this:

``` javascript
require("imports?$=jquery!./example.js");
```

This simply prepends `var $ = require("jquery");` to `example.js`.

### Syntax

Query value | Equals
------------|-------
`angular` | `var angular = require("angular");`
`$=jquery` | `var $ = require("jquery");`
`define=>false` | `var define = false;`
`config=>{size:50}` | `var config = {size:50};`
`this=>window` | `(function () { ... }).call(window);`

### Multiple values

Multiple values are separated by comma `,`:

```javascript
require("imports?$=jquery,angular,config=>{size:50}!./file.js");
```

### webpack.config.js

As always, you should rather configure this in your `webpack.config.js`:

```javascript
// ./webpack.config.js

module.exports = {
    ...
    module: {
        loaders: [
            {
                test: require.resolve("some-module"),
                loader: "imports?this=>window"
            }
        ]
};
```

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

## Typical use-cases

### jQuery plugins

`imports?$=jquery`

### Custom Angular modules

`imports?angular`

### Disable AMD

There are many modules that check for a `define` function before using CommonJS. Since webpack is capable of both, they default to AMD in this case, which can be a problem if the implementation is quirky.

Then you can easily disable the AMD path by writing

```javascript
imports?define=>false
```

For further hints on compatibility issues, check out [Shimming Modules](http://webpack.github.io/docs/shimming-modules.html) of the official docs.

## License

MIT (http://www.opensource.org/licenses/mit-license.php)
