Changelog
---------

### 4.0.2

- Fix wrong context in customImporters that was introduced with fd6be1f143a1810f7e5072a865b3d8675ba1b94e [#275](https://github.com/jtangelder/sass-loader/issues/275) [#277](https://github.com/jtangelder/sass-loader/pull/277)

### 4.0.1

- Fix custom importers receiving `'stdin'` as second argument instead of the actual `resourcePath` [#267](https://github.com/jtangelder/sass-loader/pull/267)

### 4.0.0

- **Breaking**: Release new major version because `3.2.2` was a breaking change in certain scenarios [#250](https://github.com/jtangelder/sass-loader/pull/250) [#254](https://github.com/jtangelder/sass-loader/issues/254)

### 3.2.3

- Revert changes to `3.2.1` because `3.2.2` contained a potential breaking change [#254](https://github.com/jtangelder/sass-loader/issues/254)

### 3.2.2

- Fix incorrect source map paths [#250](https://github.com/jtangelder/sass-loader/pull/250)

### 3.2.1

- Add `webpack@^2.1.0-beta` as peer dependency [#233](https://github.com/jtangelder/sass-loader/pull/233)

### 3.2.0

- Append file content instead of overwriting when `data`-option is already present [#216](https://github.com/jtangelder/sass-loader/pull/216)
- Make `indentedSyntax` option a bit smarter [#196](https://github.com/jtangelder/sass-loader/pull/196)

### 3.1.2

- Fix loader query not overriding webpack config [#189](https://github.com/jtangelder/sass-loader/pull/189)
- Update peer-dependencies [#182](https://github.com/jtangelder/sass-loader/pull/182)
  - `node-sass@^3.4.2`
  - `webpack@^1.12.6`

### 3.1.1

- Fix missing module `object-assign` [#178](https://github.com/jtangelder/sass-loader/issues/178)

### 3.1.0

- Add possibility to also define all options in your `webpack.config.js` [#152](https://github.com/jtangelder/sass-loader/pull/152) [#170](https://github.com/jtangelder/sass-loader/pull/170)
- Fix a problem where modules with a `.` in their names were not resolved [#167](https://github.com/jtangelder/sass-loader/issues/167)

### 3.0.0

- **Breaking:** Add `node-sass@^3.3.3` and `webpack@^1.12.2` as peer-dependency [#165](https://github.com/jtangelder/sass-loader/pull/165) [#166](https://github.com/jtangelder/sass-loader/pull/166) [#169](https://github.com/jtangelder/sass-loader/pull/169)
- Fix crash when Sass reported an error without `file` [#158](https://github.com/jtangelder/sass-loader/pull/158)

### 2.0.1

- Add missing path normalization [#141](https://github.com/jtangelder/sass-loader/pull/141)

### 2.0.0

- **Breaking:** Refactor [import resolving algorithm](https://github.com/jtangelder/sass-loader/blob/089c52dc9bd02ec67fb5c65c2c226f43710f231c/index.js#L293-L348). The new algorithm is aligned to libsass' way of resolving files. This yields to different results if two files with the same path and filename but with different extensions are present. Though this change should be no problem for most users, we must flag it as breaking change. [#135](https://github.com/jtangelder/sass-loader/issues/135) [#138](https://github.com/jtangelder/sass-loader/issues/138)
- Add temporary fix for stuck processes (see [sass/node-sass#857](https://github.com/sass/node-sass/issues/857)) [#100](https://github.com/jtangelder/sass-loader/issues/100) [#119](https://github.com/jtangelder/sass-loader/issues/119) [#132](https://github.com/jtangelder/sass-loader/pull/132)
- Fix path resolving on Windows [#108](https://github.com/jtangelder/sass-loader/issues/108)
- Fix file watchers on Windows [#102](https://github.com/jtangelder/sass-loader/issues/102)
- Fix file watchers for files with errors [#134](https://github.com/jtangelder/sass-loader/pull/134)

### 1.0.4

- Fix wrong source-map urls [#123](https://github.com/jtangelder/sass-loader/pull/123)
- Include source-map contents by default [#104](https://github.com/jtangelder/sass-loader/pull/104)

### 1.0.3

- Fix importing css files from scss/sass [#101](https://github.com/jtangelder/sass-loader/issues/101)
- Fix importing Sass partials from includePath [#98](https://github.com/jtangelder/sass-loader/issues/98) [#110](https://github.com/jtangelder/sass-loader/issues/110)

### 1.0.2

- Fix a bug where files could not be imported across language styles [#73](https://github.com/jtangelder/sass-loader/issues/73)
- Update peer-dependency `node-sass` to `3.1.0`

### 1.0.1

- Fix Sass partials not being resolved anymore [#68](https://github.com/jtangelder/sass-loader/issues/68)
- Update peer-dependency `node-sass` to `3.0.0-beta.4`

### 1.0.0

- Moved `node-sass^3.0.0-alpha.0` to `peerDependencies` [#28](https://github.com/jtangelder/sass-loader/issues/28)
- Using webpack's module resolver as custom importer [#39](https://github.com/jtangelder/sass-loader/issues/31)
- Add synchronous compilation support for usage with [enhanced-require](https://github.com/webpack/enhanced-require) [#39](https://github.com/jtangelder/sass-loader/pull/39)
