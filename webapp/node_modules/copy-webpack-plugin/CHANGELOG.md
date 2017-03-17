## 3.0.1 (May 29, 2016)

* Fix error thrown when subdirectories are in glob results

## 3.0.0 (May 14, 2016)

BREAKING CHANGE

* No longer writing to filesystem when webpack-dev-server is running. Use the [write-file-webpack-plugin](https://www.npmjs.com/package/write-file-webpack-plugin) to force writing files to the filesystem

## 2.1.6 (May 14, 2016)

* Readded Node v6.0.0 compatibility after finding root cause


## 2.1.5 (May 13, 2016)

* Reverted Node v6.0.0 compatibility due to import errors


## 2.1.4 (May 12, 2016)

* Fix Node v6.0.0 compatibility
* Fix tests running in Node v6.0.0
* Fix ERROR in Path must be a string. Received undefined. (undefined `to` when writing directory)


## 2.1.3 (April 23, 2016)

* Fix TypeError when working with webpack-dev-server


## 2.1.1 (April 16, 2016)

* Fixed nested directories in blobs


## 2.1.0 (April 16, 2016)

* Added pattern-level context
* Added pattern-level ignore
* Added flattening


## 2.0.0 (Apr 14, 2016)

* Several bug fixes
* Added support for webpack-dev-server
* `from` now accepts glob options
* Added `copyUnmodified` option


## 1.1.1 (Jan 25, 2016)

* `to` absolute paths are now tracked by webpack
* Reverted dot matching default for minimatch
* Params can now be passed to the `ignore` option


## 1.0.0 (Jan 24, 2016)

* Added globbing support for `from`
* Added absolute path support for `to`
* Changed default for minimatch to match dots for globs


## 0.3.0 (Nov 27, 2015)

* Added `ignore` option that functions like `.gitignore`
* Improved Windows support


## 0.2.0 (Oct 28, 2015)

* Added `force` option in patterns to overwrite prestaged assets
* Files and directories are now added to webpack's rebuild watchlist
* Only includes changed files while using webpack --watch


## 0.1.0 (Oct 26, 2015)

* Basic functionality
