# Sass loader for [webpack](http://webpack.github.io/)

## Install

`npm install sass-loader node-sass webpack --save-dev`

The sass-loader requires [node-sass](https://github.com/sass/node-sass) and [webpack](https://github.com/webpack/webpack)
as [`peerDependency`](https://docs.npmjs.com/files/package.json#peerdependencies). Thus you are able to specify the required versions accurately.

---

## Usage

[Documentation: Using loaders](http://webpack.github.io/docs/using-loaders.html)

``` javascript
var css = require("!raw!sass!./file.scss");
// returns compiled css code from file.scss, resolves Sass imports
var css = require("!css!sass!./file.scss");
// returns compiled css code from file.scss, resolves Sass and CSS imports and url(...)s
```

Use in tandem with the [`style-loader`](https://github.com/webpack/style-loader) and [`css-loader`](https://github.com/webpack/css-loader) to add the css rules to your document:

``` javascript
require("!style!css!sass!./file.scss");
```
*Please note: If you encounter module errors complaining about a missing `style` or `css` module, make sure you have installed all required loaders via npm.*

### Apply via webpack config

It's recommended to adjust your `webpack.config` so `style!css!sass!` is applied automatically on all files ending on `.scss`:

``` javascript
module.exports = {
  ...
  module: {
    loaders: [
      {
        test: /\.scss$/,
        loaders: ["style", "css", "sass"]
      }
    ]
  }
};
```

Then you only need to write: `require("./file.scss")`.

### Sass options

You can pass options to node-sass by defining a `sassLoader`-property on your `webpack.config.js`. See [node-sass](https://github.com/andrew/node-sass) for all available Sass-options.

```javascript
module.exports = {
  ...
  module: {
    loaders: [
      {
        test: /\.scss$/,
        loaders: ["style", "css", "sass"]
      }
    ]
  },
  sassLoader: {
    includePaths: [path.resolve(__dirname, "./some-folder")]
  }
};
```

Passing your options as [query parameters](http://webpack.github.io/docs/using-loaders.html#query-parameters) is also supported, but can get confusing if you need to set a lot of options.

If you need to define two different loader configs, you can also change the config's property name via `sass?config=otherSassLoaderConfig`:

```javascript
module.exports = {
  ...
  module: {
    loaders: [
      {
        test: /\.scss$/,
        loaders: ["style", "css", "sass?config=otherSassLoaderConfig"]
      }
    ]
  },
  otherSassLoaderConfig: {
    ...
  }
};
```

### Imports

webpack provides an [advanced mechanism to resolve files](http://webpack.github.io/docs/resolving.html). The sass-loader uses node-sass' custom importer feature to pass all queries to the webpack resolving engine. Thus you can import your Sass modules from `node_modules`. Just prepend them with a `~` to tell webpack that this is not a relative import:

```css
@import "~bootstrap/css/bootstrap";
```

Alternatively, for bootstrap-sass:
```css
@import "~bootstrap-sass/assets/stylesheets/bootstrap";
```

It's important to only prepend it with `~`, because `~/` resolves to the home directory. webpack needs to distinguish between `bootstrap` and `~bootstrap` because CSS- and Sass-files have no special syntax for importing relative files. Writing `@import "file"` is the same as `@import "./file";`

### Environment variables

If you want to prepend Sass code before the actual entry file, you can simply set the `data`-option. In this case, the sass-loader will not override the `data`-option but just append the entry's content. This is especially useful when some of your Sass variables depend on the environment:

```javascript
module.exports = {
  ...
  sassLoader: {
    data: "$env: " + process.env.NODE_ENV + ";"
  }
};
```


### Problems with `url(...)`

Since Sass/[libsass](https://github.com/sass/libsass) does not provide [url rewriting](https://github.com/sass/libsass/issues/532), all linked assets must be relative to the output.

- If you're just generating CSS without passing it to the css-loader, it must be relative to your web root.
- If you pass the generated CSS on to the css-loader, all urls must be relative to the entry-file (e.g. `main.scss`).

More likely you will be disrupted by this second issue. It is natural to expect relative references to be resolved against the `.scss`-file in which they are specified (like in regular `.css`-files). Thankfully there are a two solutions to this problem:

- Add the missing url rewriting using the [resolve-url-loader](https://github.com/bholloway/resolve-url-loader). Place it directly after the sass-loader in the loader chain.
- Library authors usually provide a variable to modify the asset path. [bootstrap-sass](https://github.com/twbs/bootstrap-sass) for example has an `$icon-font-path`. Check out [this working bootstrap example](https://github.com/jtangelder/sass-loader/tree/master/test/bootstrapSass).

### Extracting stylesheets

Bundling CSS with webpack has some nice advantages like referencing images and fonts with hashed urls or [hot module replacement](http://webpack.github.io/docs/hot-module-replacement-with-webpack.html) in development. In production, on the other hand, it's not a good idea to apply your stylesheets depending on JS execution. Rendering may be delayed or even a [FOUC](https://en.wikipedia.org/wiki/Flash_of_unstyled_content) might be visible. Thus it's often still better to have them as separate files in your final production build.

There are two possibilties to extract a stylesheet from the bundle:

- [extract-loader](https://github.com/peerigon/extract-loader) (simpler, but specialized on the css-loader's output)
- [extract-text-webpack-plugin](https://github.com/webpack/extract-text-webpack-plugin) (more complex, but works in all use-cases)

### Source maps

To enable CSS Source maps, you'll need to pass the `sourceMap`-option to the sass- *and* the css-loader. Your `webpack.config.js` should look like this:

```javascript
module.exports = {
    ...
    devtool: "source-map", // or "inline-source-map"
    module: {
        loaders: [
            {
                test: /\.scss$/,
                loaders: ["style", "css?sourceMap", "sass?sourceMap"]
            }
        ]
    }
};
```

If you want to edit the original Sass files inside Chrome, [there's a good blog post](https://medium.com/@toolmantim/getting-started-with-css-sourcemaps-and-in-browser-sass-editing-b4daab987fb0). Checkout [test/sourceMap](https://github.com/jtangelder/sass-loader/tree/master/test) for a running example.

## License

MIT (http://www.opensource.org/licenses/mit-license.php)
