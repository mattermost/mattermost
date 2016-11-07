# gifsicle-bin [![Build Status](https://travis-ci.org/imagemin/gifsicle-bin.svg?branch=master)](https://travis-ci.org/imagemin/gifsicle-bin)

> gifsicle manipulates GIF image files in many different ways. Depending on command line options, it can merge several GIFs into a GIF animation; explode an animation into its component frames; change individual frames in an animation; turn interlacing on and off; add transparency and much more.


## Install

```
$ npm install --save gifsicle
```


## Usage

```js
const {execFile} = require('child_process');
const gifsicle = require('gifsicle');

execFile(gifsicle, ['-o', 'output.gif', 'input.gif'], err => {
	console.log('Image minified!');
});
```


## CLI

```
$ npm install --global gifsicle
```

```
$ gifsicle --help
```


## License

MIT © [imagemin](https://github.com/imagemin)
