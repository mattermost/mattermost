<p align="center">
  <a href="http://gulpjs.com">
    <img height="257" width="114" src="https://raw.githubusercontent.com/gulpjs/artwork/master/gulp-2x.png">
  </a>
</p>

# glob-stream

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coveralls Status][coveralls-image]][coveralls-url] [![Gitter chat][gitter-image]][gitter-url]

A wrapper around [node-glob][node-glob-url] to make it streamy.

## Usage

```javascript
var gs = require('glob-stream');

var stream = gs.create('./files/**/*.coffee', { /* options */ });

stream.on('data', function(file){
  // file has path, base, and cwd attrs
});
```

You can pass any combination of globs. One caveat is that you can not only pass a glob negation, you must give it at least one positive glob so it knows where to start. All given must match for the file to be returned.

## API

### create(globs, options)

Returns a stream for multiple globs or filters.

### createStream(positiveGlob, negativeGlobs, options)

Returns a stream for a single glob or filter.

### Options

- cwd
  - Default is `process.cwd()`
- base
  - Default is everything before a glob starts (see [glob-parent][glob-parent-url])
- cwdbase
  - Default is `false`
  - When true it is the same as saying opt.base = opt.cwd
- allowEmpty
  - Default is `false`
  - If true, won't emit an error when a glob pointing at a single file fails to match
- Any through2 related options are documented in [through2][through2-url]

This argument is passed directly to [node-glob][node-glob-url] so check there for more options

### Glob

```js
var stream = gs.create(['./**/*.js', '!./node_modules/**/*']);
```

Globs are executed in order, so negations should follow positive globs. For example:

```js
gulp.src(['!b*.js', '*.js'])
```

would not exclude any files, but this would

```js
gulp.src(['*.js', '!b*.js'])
```

## Related

- [globby][globby-url] - Non-streaming `glob` wrapper with support for multiple patterns.

## License

MIT

[globby-url]: https://github.com/sindresorhus/globby
[through2-url]: https://github.com/rvagg/through2
[node-glob-url]: https://github.com/isaacs/node-glob
[glob-parent-url]: https://github.com/es128/glob-parent

[downloads-image]: http://img.shields.io/npm/dm/glob-stream.svg
[npm-url]: https://www.npmjs.com/package/glob-stream
[npm-image]: https://badge.fury.io/js/glob-stream.svg

[travis-url]: https://travis-ci.org/gulpjs/glob-stream
[travis-image]: https://travis-ci.org/gulpjs/glob-stream.svg?branch=master

[coveralls-url]: https://coveralls.io/r/gulpjs/glob-stream
[coveralls-image]: https://coveralls.io/repos/gulpjs/glob-stream/badge.svg

[gitter-url]: https://gitter.im/gulpjs/gulp
[gitter-image]: https://badges.gitter.im/gulpjs/gulp.png
