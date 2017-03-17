Change History
==============

v2.22.0
---
* Update dependencies

v2.21.1
---
* Better error handling (#354)

v2.21.0
----
* Add `html-webpack-plugin-alter-asset-tags` event to allow plugins to adjust the script/link tags

v2.20.0
----
* Exclude chunks works now even if combined with dependency sort

v2.19.0
----
* Add `html-webpack-plugin-alter-chunks` event for custom chunk sorting and interpolation

v2.18.0
----
* Updated all dependencies

v2.17.0
----
* Add `type` attribute to `script` element to prevent issues in Safari 9.1.1

v2.16.2
----
* Fix bug introduced by 2.16.2. Fixes #315

v2.16.1
----
* Fix hot module replacement for webpack 2.x

v2.16.0
----
* Add support for dynamic filenames like index[hash].html

v2.15.0
----
* Add full unit test coverage for the webpack 2 beta version
* For webpack 2 the default sort will be 'dependency' instead of 'id'
* Upgrade dependencies

v2.14.0
----
* Export publicPath to the template
* Add example for inlining css and js

v2.13.0
----
* Add support for absolute output file names
* Add support for relative file names outside the output path

v2.12.0
----
* Basic Webpack 2.x support #225

v2.11.0
----
* Add `xhtml` option which is turned of by default. When activated it will inject self closed `<link href=".." />` tags instead of unclosed `<link href="..">` tags. https://github.com/ampedandwired/html-webpack-plugin/pull/255
* Add support for webpack placeholders inside the public path e.g. `'/dist/[hash]/'`. https://github.com/ampedandwired/html-webpack-plugin/pull/249

v2.10.0
----
* Add `hash` field to the chunk object
* Add `compilation` field to the templateParam object (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/237)
* Add `html-webpack-plugin-before-html-generation` event
* Improve error messages

v2.9.0
----
* Fix favicon path (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/185, https://github.com/ampedandwired/html-webpack-plugin/issues/208, https://github.com/ampedandwired/html-webpack-plugin/pull/215 )

v2.8.2
----
* Support relative URLs on Windows (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/205 )

v2.8.1
----
* Caching improvements (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/204 )

v2.8.0
----
* Add `dependency` mode for `chunksSortMode` to sort chunks based on their dependencies with each other

v2.7.2
----
* Add support for require in js templates

v2.7.1
----
* Refactoring
* Fix relative windows path

v2.6.5
----
* Minor refactoring

v2.6.4
----
* Fix for `"Uncaught TypeError: __webpack_require__(...) is not a function"`
* Fix incomplete cache modules causing "HtmlWebpackPlugin Error: No source available"
* Fix some issues on Windows

v2.6.3
----
* Prevent parsing the base template with the html-loader

v2.6.2
----
* Fix `lodash` resolve error (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/172 )

v2.6.1
----
* Fix missing module (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/164 )

v2.6.0
----
* Move compiler to its own file
* Improve error messages
* Fix global HTML_WEBPACK_PLUGIN variable

v2.5.0
----
* Support `lodash` template's HTML _"escape"_ delimiter (`<%- %>`)
* Fix bluebird warning (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/130 )
* Fix an issue where incomplete cache modules were used

v2.4.0
----
* Don't recompile if the assets didn't change

v2.3.0
----
* Add events `html-webpack-plugin-before-html-processing`, `html-webpack-plugin-after-html-processing`, `html-webpack-plugin-after-emit` to allow other plugins to alter the html this plugin executes

v2.2.0
----
* Inject css and js even if the html file is incomplete (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/135 )
* Update dependencies

v2.1.0
----
* Synchronize with the stable `@1` version

v2.0.4
----
* Fix `minify` option
* Fix missing hash interpolation in publicPath

v2.0.3
----
* Add support for webpack.BannerPlugin

v2.0.2
----
* Add support for loaders in templates (fixes https://github.com/ampedandwired/html-webpack-plugin/pull/41 )
* Remove `templateContent` option from configuration
* Better error messages
* Update dependencies


v1.7.0
----
* Add `chunksSortMode` option to configuration to control how chunks should be sorted before they are included to the html
* Don't insert async chunks into html (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/95 )
* Update dependencies

v1.6.2
----
* Fix paths on Windows
* Fix missing hash interpolation in publicPath
* Allow only `false` or `object` in `minify` configuration option

v1.6.1
----
* Add `size` field to the chunk object
* Fix stylesheet `<link>`s being discarded when used with `"inject: 'head'"`
* Update dependencies

v1.6.0
----
* Support placing templates in subfolders
* Don't include chunks with undefined name (fixes https://github.com/ampedandwired/html-webpack-plugin/pull/60 )
* Don't include async chunks

v1.5.2
----
* Update dependencies (lodash)

v1.5.1
----
* Fix error when manifest is specified (fixes https://github.com/ampedandwired/html-webpack-plugin/issues/56 )

v1.5.0
----
* Allow to inject javascript files into the head of the html page
* Fix error reporting

v1.4.0
----
* Add `favicon.ico` option
* Add html minifcation

v1.2.0
------
* Set charset using HTML5 meta attribute
* Reload upon change when using webpack watch mode
* Generate manifest attribute when using
  [appcache-webpack-plugin](https://github.com/lettertwo/appcache-webpack-plugin)
* Optionally add webpack hash as a query string to resources included in the HTML
  (`hash: true`) for cache busting
* CSS files generated using webpack (for example, by using the
  [extract-text-webpack-plugin](https://github.com/webpack/extract-text-webpack-plugin))
  are now automatically included into the generated HTML
* More detailed information about the files generated by webpack is now available
  to templates in the `o.htmlWebpackPlugin.files` attribute. See readme for more
  details. This new attribute deprecates the old `o.htmlWebpackPlugin.assets` attribute.
* The `templateContent` option can now be a function that returns the template string to use
* Expose webpack configuration to templates (`o.webpackConfig`)
* Sort chunks to honour dependencies between them (useful for use with CommonsChunkPlugin).
