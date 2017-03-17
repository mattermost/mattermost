# decompress-tar [![Build Status](http://img.shields.io/travis/kevva/decompress-tar.svg?style=flat)](https://travis-ci.org/kevva/decompress-tar)

> tar decompress plugin

## Install

```sh
$ npm install --save decompress-tar
```

## Usage

```js
var Decompress = require('decompress');
var tar = require('decompress-tar');

var decompress = new Decompress()
	.src('foo.tar')
	.dest('dest')
	.use(tar({strip: 1}));

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
var tar = require('decompress-tar');
var vinylAssign = require('vinyl-assign');

gulp.task('default', function () {
	return gulp.src('foo.tar')
		.pipe(vinylAssign({extract: true}))
		.pipe(tar({strip: 1}))
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
