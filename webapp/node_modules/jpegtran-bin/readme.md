# jpegtran-bin [![Build Status](https://travis-ci.org/imagemin/jpegtran-bin.svg?branch=master)](https://travis-ci.org/imagemin/jpegtran-bin)

> libjpeg-turbo is a derivative of libjpeg that uses SIMD instructions (MMX, SSE2, NEON) to accelerate baseline JPEG compression and decompression on x86, x86-64, and ARM systems. On such systems, libjpeg-turbo is generally 2-4x as fast as the unmodified version of libjpeg, all else being equal.


## Install

```
$ npm install --save jpegtran-bin
```


## Usage

```js
var execFile = require('child_process').execFile;
var jpegtran = require('jpegtran-bin');

execFile(jpegtran, ['-outfile', 'output.jpg', 'input.jpg'], function (err) {
	console.log('Image minified!');
});
```


## CLI

```
$ npm install --global jpegtran-bin
```

```
$ jpegtran --help
```


## License

MIT © [imagemin](https://github.com/imagemin)
