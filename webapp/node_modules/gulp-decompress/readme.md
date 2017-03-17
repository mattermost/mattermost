# gulp-decompress [![Build Status](http://img.shields.io/travis/kevva/gulp-decompress.svg?style=flat)](https://travis-ci.org/kevva/gulp-decompress)

> Extract TAR, TAR.BZ2, TAR.GZ and ZIP archives using [decompress](https://github.com/kevva/decompress)


## Install

```
$ npm install --save gulp-decompress
```


## Usage

```js
var decompress = require('gulp-decompress');
var gulp = require('gulp');

gulp.task('default', function () {
	return gulp.src('*.{tar,tar.bz2,tar.gz,zip}')
		.pipe(decompress({strip: 1}))
		.pipe(gulp.dest('dist'));
});
```


## Options

### mode

Type: `string`

Set mode on the extracted files, i.e `{mode: '755'}`.

### strip

Type: `number`

Equivalent to `--strip-components` for tar.


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
