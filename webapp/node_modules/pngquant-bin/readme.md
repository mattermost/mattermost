# pngquant-bin [![Build Status](https://travis-ci.org/imagemin/pngquant-bin.svg?branch=master)](https://travis-ci.org/imagemin/pngquant-bin)

> pngquant is a command-line utility for converting 24/32-bit PNG images to paletted (8-bit) PNGs. The conversion reduces file sizes significantly (often as much as 70%) and preserves full alpha transparency.


## Install

```
$ npm install --save pngquant-bin
```


## Usage

```js
const execFile = require('child_process').execFile;
const pngquant = require('pngquant-bin');

execFile(pngquant, ['-o', 'output.png', 'input.png'], err => {
	console.log('Image minified!');
});
```


## CLI

```
$ npm install --global pngquant-bin
```

```
$ pngquant --help
```


## License

MIT © [imagemin](https://github.com/imagemin)
