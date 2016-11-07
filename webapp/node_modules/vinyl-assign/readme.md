# vinyl-assign [![Build Status](http://img.shields.io/travis/kevva/vinyl-assign.svg?style=flat)](https://travis-ci.org/kevva/vinyl-assign)

> Assign custom attributes to vinyl files


## Install

```
$ npm install --save vinyl-assign
```


## Usage

```js
var gulp = require('gulp');
var vinylAssign = require('vinyl-assign');

gulp.task('default', function () {
	return gulp.src('foo.txt')
		.pipe(vinylAssign({foo: 'bar'}))
		.pipe(gulp.dest('dest'));
});
```


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
