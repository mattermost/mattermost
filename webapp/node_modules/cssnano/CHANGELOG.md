# 3.8.0

* Adds support for normalizing multiple values for the `display` property. For
  example `block flow` can be simplified to `block`.

# 3.7.7

* Further improves CSS mixin handling; semicolons will no longer be stripped
  from *rules* as well as declarations.

# 3.7.6

* Resolves an issue where the semicolon was being incorrectly stripped
  from CSS mixins.

# 3.7.5

* Resolves an issue where the `safe` flag was not being persisted across
  multiple files (thanks to @techmatt101).

# 3.7.4

* Improves performance of the reducePositions transform by testing
  against `hasOwnProperty` instead of using an array of object keys.
* Removes the redundant `indexes-of` dependency.

# 3.7.3

* Unpins postcss-filter-plugins from `2.0.0` as a fix has landed in the new
  version of uniqid.

# 3.7.2

* Temporarily pins postcss-filter-plugins to version `2.0.0` in order to
  mitigate an issue with uniqid `3.0.0`.

# 3.7.1

* Enabling safe mode now turns off both postcss-merge-idents &
  postcss-normalize-url's `stripWWW` option.

# 3.7.0

* Added: Reduce `background-repeat` definitions; works with both this property
  & the `background` shorthand, and aims to compress the extended two value
  syntax into the single value syntax.
* Added: Reduce `initial` values for properties when the *actual* initial value
  is shorter; for example, `min-width: initial` becomes `min-width: 0`.

# 3.6.2

* Fixed an issue where cssnano would crash on `steps(1)`.

# 3.6.1

* Fixed an issue where cssnano would crash on `steps` functions with a
  single argument.

# 3.6.0

* Added `postcss-discard-overridden` to safely discard overridden rules with
  the same identifier (thanks to @Justineo).
* Added: Reduce animation/transition timing functions. Detects `cubic-bezier`
  functions that are equivalent to the timing keywords and compresses, as well
  as normalizing the `steps` timing function.
* Added the `perspective-origin` property to the list of supported properties
  transformed by the `reduce-positions` transform.

# 3.5.2

* Resolves an issue where the 3 or 4 value syntax for `background-position`
  were being incorrectly converted.

# 3.5.1

* Improves checking for `background-position` values in the `background`
  shorthand property.

# 3.5.0

* Adds a new optimisation path which can minimise keyword values for
  `background-position` and the `background` shorthand.
* Tweaks to performance in the `core` module, now performs less AST passes.
* Now compiled with Babel 6.

# 3.4.0

* Adds a new optimisation path which can minimise gradient parameters
  automatically.

# 3.3.2

* Fixes an issue where using `options.safe` threw an error when cssnano was
  not used as part of a PostCSS instance, but standalone (such as in modules
  like gulp-cssnano). cssnano now renames `safe` internally to `isSafe`.

# 3.3.1

* Unpins postcss-colormin from `2.1.2`, as the `2.1.3` & `2.1.4` patches had
  optimization regressions that are now resolved in `2.1.5`.

# 3.3.0

* Updated modules to use postcss-value-parser version 3 (thanks to @TrySound).
* Now converts between transform functions with postcss-reduce-transforms.
  e.g. `translate3d(0, 0, 0)` becomes `translateZ(0)`.

# 3.2.0

* cssnano no longer converts `outline: none` to `outline: 0`, as there are
  some cases where the values are not equivalent (thanks to @TrySound).
* cssnano no longer converts for example `16px` to `1pc` *by default*. Length
  optimisations can be turned on via `{convertValues: {length: true}}`.
* Improved minimization of css functions (thanks to @TrySound).

# 3.1.0

* This release swaps postcss-single-charset for postcss-normalize-charset,
  which can detect encoding to determine whether a charset is necessary.
  Optionally, you can set the `add` option to `true` to prepend a UTF-8
  charset to the output automatically (thanks to @TrySound).
* A `safe` option was added, which disables more aggressive optimisations, as
  a convenient preset configuration (thanks to @TrySound).
* Added an option to convert from `deg` to `turn` & vice versa, & improved
  minification performance in functions (thanks to @TrySound).

# 3.0.3

* Fixes an issue where cssnano was removing spaces around forward slashes in
  string literals (thanks to @TrySound).

# 3.0.2

* Fixes an issue where cssnano was removing spaces around forward slashes in
  calc functions.

# 3.0.1

* Replaced css-list & balanced-match with postcss-value-parser, reducing the
  module's overall size (thanks to @TrySound).

# 3.0.0

* All cssnano plugins and cssnano itself have migrated to PostCSS 5.x. Please
  make sure that when using the 3.x releases that you use a 5.x compatible
  PostCSS runner.
* cssnano will now compress inline SVG through SVGO. Because of this change,
  interfacing with cssnano must now be done through an asynchronous API. The
  main `process` method has the same signature as a PostCSS processor instance.
* The old options such as `merge` & `fonts` that were deprecated in
  release `2.5.0` were removed. The new architecture allows you to specify any
  module name to disable it.
* postcss-minify-selectors' at-rule compression was extracted out into
  postcss-minify-params (thanks to @TrySound).
* Overall performance of the module has improved dramatically, thanks to work
  by @TrySound and input from the community.
* Improved selector merging/deduplication in certain use cases.
* cssnano no longer compresses hex colours in filter properties, to better
  support old versions of Internet Explorer (thanks to @faddee).
* cssnano will not merge properties together that have an `inherit` keyword.
* postcss-minify-font-weight & postcss-font-family were consolidated into
  postcss-minify-font-values. Using the old options will print deprecation
  warnings (thanks to @TrySound).
* The cssnano CLI was extracted into a separate module, so that dependent
  modules such as gulp-cssnano don't download unnecessary extras.

# 2.6.1

* Improved performance of the core module `functionOptimiser`.

# 2.6.0

* Adds a new optimisation which re-orders properties that accept values in
  an arbitrary order. This can lead to improved merging behaviour in certain
  cases.

# 2.5.0

* Adds support for disabling modules of the user's choosing, with new option
  names. The old options (such as `merge` & `fonts`) will be removed in `3.0`.

# 2.4.0

* postcss-minify-selectors was extended to add support for conversion of
  `::before` to `:before`; this release removes the dedicated
  postcss-pseudoelements module.

# 2.3.0

* Consolidated postcss-minify-trbl & two integrated modules into
  postcss-merge-longhand.

# 2.2.0

* Replaced integrated plugin filter with postcss-filter-plugins.
* Improved rule merging logic.
* Improved performance across the board by reducing AST iterations where it
  was possible to do so.
* cssnano will now perform better whitespace compression when used with other
  PostCSS plugins.

# 2.1.1

* Fixes an issue where options were not passed to normalize-url.

# 2.1.0

* Allow `postcss-font-family` to be disabled.

# 2.0.3

* cssnano can now be consumed with the parentheses-less method in PostCSS; e.g.
  `postcss([ cssnano ])`.
* Fixes an issue where 'Din' was being picked up by the logic as a numeric
  value, causing the full font name to be incorrectly rearranged.

# 2.0.2

* Extract trbl value reducing into a separate module.
* Refactor core longhand optimiser to not rely on trbl cache.
* Adds support for `ch` units; previously they were removed.
* Fixes parsing of some selector hacks.
* Fixes an issue where embedded base 64 data was being converted as if it were
  a URL.

# 2.0.1

* Add `postcss-plugin` keyword to package.json.
* Wraps all core processors with the PostCSS 4.1 plugin API.

# 2.0.0

* Adds removal of outdated vendor prefixes based on browser support.
* Addresses an issue where relative path separators were converted to
  backslashes on Windows.
* cssnano will now detect previous plugins and silently disable them when the
  functionality overlaps. This is to enable faster interoperation with cssnext.
* cssnano now exports as a PostCSS plugin. The simple interface is exposed
  at `cssnano.process(css, opts)` instead of `cssnano(css, opts)`.
* Improved URL detection when using two or more in the same declaration.
* node 0.10 is no longer officially supported.

# 1.4.3

* Fixes incorrect minification of `background:none` to `background:0 0`.

# 1.4.2

* Fixes an issue with nested URLs inside `url()` functions.

# 1.4.1

* Addresses an issue where whitespace removal after a CSS function would cause
  rendering issues in Internet Explorer.

# 1.4.0

* Adds support for removal of unused `@keyframes` and `@counter-style` at-rules.
* comments: adds support for user-directed removal of comments, with the
  `remove` option (thanks to @dmitrykiselyov).
* comments: `removeAllButFirst` now operates on each CSS tree, rather than the
  first one passed to cssnano.

# 1.3.3

* Fixes incorrect minification of `border:none` to `border:0 0`.

# 1.3.2

* Improved selector minifying logic, leading to better compression of attribute
  selectors.
* Improved comment discarding logic.

# 1.3.1

* Fixes crash on undefined `decl.before` from prior AST.

# 1.3.0

* Added support for bundling cssnano using webpack (thanks to @MoOx).

# 1.2.1

* Fixed a bug where a CSS function keyword inside its value would throw
  an error.

# 1.2.0

* Better support for merging properties without the existance of a shorthand
  override.
* Can now 'merge forward' adjacent rules as well as the previous 'merge behind'
  behaviour, leading to better compression.
* Selector re-ordering now happens last in the chain of plugins, to help clean
  up merged selectors.

# 1.1.0

* Now can merge identifiers such as `@keyframes` and `@counter-style` if they
  have duplicated properties but are named differently.
* Fixes an issue where duplicated keyframes with the same name would cause
  an infinite loop.

# 1.0.2

* Improve module loading logic (thanks to @tunnckoCore).
* Improve minification of numeric values, with better support for `rem`,
  trailing zeroes and slash/comma separated values
  (thanks to @TrySound & @tunnckoCore).
* Fixed an issue where `-webkit-tap-highlight-color` values were being
  incorrectly transformed to `transparent`. This is not supported in Safari.
* Added support for viewport units (thanks to @TrySound).
* Add MIT license file.

# 1.0.1

* Add repository/author links to package.json.

# 1.0.0

* Initial release.
