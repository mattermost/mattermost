# decompress-tarbz2 [![Build Status](http://img.shields.io/travis/kevva/decompress-tarbz2.svg?style=flat)](https://travis-ci.org/kevva/decompress-tarbz2)

> tar.bz2 decompress plugin

## Install

```sh
$ npm install --save decompress-tarbz2
```

## Usage

```js
var Decompress = require('decompress');
var tarbz2 = require('decompress-tarbz2');

var decompress = new Decompress()
	.src('foo.tar.bz2')
	.dest('dest')
	.use(tarbz2({strip: 1}));

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
var tarbz2 = require('decompress-tarbz2');
var vinylAssign = require('vinyl-assign');

gulp.task('default', function () {
	return gulp.src('foo.tar.bz2')
		.pipe(vinylAssign({extract: true}))
		.pipe(tarbz2({strip: 1}))
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
