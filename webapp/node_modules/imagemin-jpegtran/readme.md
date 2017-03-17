# imagemin-jpegtran [![Build Status](https://travis-ci.org/imagemin/imagemin-jpegtran.svg?branch=master)](https://travis-ci.org/imagemin/imagemin-jpegtran) [![Build status](https://ci.appveyor.com/api/projects/status/rwf4by6qcbne1qet?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/imagemin-jpegtran)

> jpegtran imagemin plugin


## Install

```
$ npm install --save imagemin-jpegtran
```


## Usage

```js
const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');

imagemin(['images/*.jpg'], 'build/images', {use: [imageminJpegtran()]}).then(() => {
	console.log('Images optimized');
});
```


## API

### imageminJpegtran([options])(buffer)

Returns a promise for a buffer.

#### options

##### progressive

Type: `boolean`<br>
Default: `false`

Lossless conversion to progressive.

##### arithmetic

Type: `boolean`<br>
Default: `false`

Use [arithmetic coding](http://en.wikipedia.org/wiki/Arithmetic_coding).

#### buffer

Type: `buffer`

Buffer to optimize.


## License

MIT © [imagemin](https://github.com/imagemin)
