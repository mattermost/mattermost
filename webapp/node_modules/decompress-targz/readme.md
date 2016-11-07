# decompress-targz [![Build Status](http://img.shields.io/travis/kevva/decompress-targz.svg?style=flat)](https://travis-ci.org/kevva/decompress-targz)

> tar.gz decompress plugin

## Install

```sh
$ npm install --save decompress-targz
```

## Usage

```js
var Decompress = require('decompress');
var targz = require('decompress-targz');

var decompress = new Decompress()
	.src('foo.tar.gz')
	.dest('dest')
	.use(targz({strip: 1}));

decompress.run(function (err, files) {
	if (err) {
		throw err;
	}

	console.log('Files extracted successfully!'); 
});
```

You can also use this plugin with [gulp](http://gulpjs.com):

```js
var gulp = require('gulp');
var targz = require('decompress-targz');
var vinylAssign = require('vinyl-assign');

gulp.task('default', function () {
	return gulp.src('foo.tar.gz')
		.pipe(vinylAssign({extract: true}))
		.pipe(targz({strip: 1}))
		.pipe(gulp.dest('dest'));
});
```

## Options

### strip

Type: `Number`  
Default: `0`

Equivalent to `--strip-components` for tar.

## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
