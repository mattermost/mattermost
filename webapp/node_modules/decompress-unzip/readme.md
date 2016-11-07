# decompress-unzip [![Build Status](https://travis-ci.org/kevva/decompress-unzip.svg?branch=master)](https://travis-ci.org/kevva/decompress-unzip)

> zip decompress plugin


## Install

```
$ npm install --save decompress-unzip
```


## Usage

```js
const Decompress = require('decompress');
const decompressUnzip = require('decompress-unzip');

new Decompress()
	.src('foo.zip')
	.dest('dest')
	.use(decompressUnzip({strip: 1}))
	.run();
```

You can also use this plugin with [gulp](http://gulpjs.com):

```js
const decompressUnzip = require('decompress-unzip');
const gulp = require('gulp');
const vinylAssign = require('vinyl-assign');

gulp.task('default', () => {
	return gulp.src('foo.zip')
		.pipe(vinylAssign({extract: true}))
		.pipe(decompressUnzip({strip: 1}))
		.pipe(gulp.dest('dest'));
});
```


## API

### decompressUnzip(options)

#### options.strip

Type: `number`  
Default: `0`

Remove leading directory components from extracted files.


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
