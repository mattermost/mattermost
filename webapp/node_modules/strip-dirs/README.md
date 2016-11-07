# strip-dirs 

[![NPM version](https://img.shields.io/npm/v/strip-dirs.svg)](https://www.npmjs.com/package/strip-dirs)
[![Build Status](https://img.shields.io/travis/shinnn/node-strip-dirs.svg)](https://travis-ci.org/shinnn/node-strip-dirs)
[![Build status](https://ci.appveyor.com/api/projects/status/pr5edbtg59f6xfgn?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/node-strip-dirs)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/node-strip-dirs.svg)](https://coveralls.io/r/shinnn/node-strip-dirs)
[![Dependency Status](https://img.shields.io/david/shinnn/node-strip-dirs.svg?label=deps)](https://david-dm.org/shinnn/node-strip-dirs)
[![devDependency Status](https://img.shields.io/david/dev/shinnn/node-strip-dirs.svg?label=devDeps)](https://david-dm.org/shinnn/node-strip-dirs#info=devDependencies)

Remove leading directory components from a path, like [tar(1)](http://linuxcommand.org/man_pages/tar1.html)'s `--strip-components` option

```javascript
var stripDirs = require('strip-dirs');

stripDirs('foo/bar/baz', 1); //=> 'bar/baz'
stripDirs('foo/bar/baz', 2); //=> 'baz'
stripDirs('foo/bar/baz', 999); //=> 'baz'
```

## Installation

[Use npm](https://docs.npmjs.com/cli/install).

```sh
npm install --save strip-dirs
```

## API

```javascript
var stripDirs = require('strip-dirs');
```

### stripDirs(*path*, *count* [, *option*])

*path*: `String` (A relative path)  
*count*: `Number` (0, 1, 2, ...)  
*option*: `Object`  
Return: `String`

It removes directory components from the beginning of the *path* by *count*.

```javascript
var stripDirs = require('strip-dirs');

stripDirs('foo/bar', 1); //=> 'bar'
stripDirs('foo/bar/baz', 2); //=> 'bar'
stripDirs('foo/././/bar/./', 1); //=> 'bar'
stripDirs('foo/bar', 0); //=> 'foo/bar'

stripDirs('/foo/bar', 1) // throw an error because the path is an absolute path
```

If you want to remove all directory components certainly, use [`path.basename`](http://nodejs.org/api/path.html#path_path_basename_p_ext) instead of this module.

#### option.narrow

Type: `Boolean`  
Default: `false`

By default, it keeps the last path component when path components are fewer than the *count*.

If this option is enabled, it throws an error in such case.

```javascript
stripDirs('foo/bar/baz', 9999); //=> 'baz'

stripDirs('foo/bar/baz', 9999, {narrow: true}); // throws an error
```

## CLI

You can use this module as `strip-dirs` command by installing it globally.

```sh
npm install -g strip-dirs
```

### Usage

```sh
strip-dirs <string> --count(or -c) <number> [--narrow(or -n)]
```

Or, use with pipe(`|`):

```sh
echo <string> | strip-dirs --count(or -c) <number> [--narrow(or -n)]
```

### Flags

```sh
--count,  -c: Number of directories to strip from the path
--narrow, -n: Disallow surplus count of directory level
```

## License

Copyright (c) [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
