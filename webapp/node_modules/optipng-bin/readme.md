# optipng-bin [![Build Status](https://travis-ci.org/imagemin/optipng-bin.svg?branch=master)](https://travis-ci.org/imagemin/optipng-bin)

> [OptiPNG](http://optipng.sourceforge.net) is a PNG optimizer that recompresses 
image files to a smaller size, without losing any information.


## Install

```
$ npm install --save optipng-bin
```


## Usage

```js
const {execFile} = require('child_process');
const optipng = require('optipng-bin');

execFile(optipng, ['-out', 'output.png', 'input.png'], err => {
	console.log('Image minified!');
});
```


## CLI

```
$ npm install --global optipng-bin
```

```
$ optipng --help
```


## License

MIT © [imagemin](https://github.com/imagemin)
