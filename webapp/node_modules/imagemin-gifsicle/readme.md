# imagemin-gifsicle [![Build Status](http://img.shields.io/travis/imagemin/imagemin-gifsicle.svg?style=flat)](https://travis-ci.org/imagemin/imagemin-gifsicle) [![Build status](https://ci.appveyor.com/api/projects/status/51vfu1ntxwx7t949?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/imagemin-gifsicle)

> gifsicle imagemin plugin


## Install

```
$ npm install --save imagemin-gifsicle
```


## Usage

```js
const imagemin = require('imagemin');
const imageminGifsicle = require('imagemin-gifsicle');

imagemin(['images/*.gif'], 'build/images', {use: [imageminGifsicle()]}).then(() => {
	console.log('Images optimized');
});
```


## API

### imageminGifsicle([options])(buffer)

Returns a promise for a buffer.

#### options

##### interlaced

Type: `boolean`<br>
Default: `false`

Interlace gif for progressive rendering.

##### optimizationLevel

Type: `number`<br>
Default: `1`

Select an optimization level between `1` and `3`.

> The optimization level determines how much optimization is done; higher levels take longer, but may have better results.

1. Stores only the changed portion of each image.
2. Also uses transparency to shrink the file further.
3. Try several optimization methods (usually slower, sometimes better results)

##### colors

Type: `number`

Reduce the number of distinct colors in each output GIF to num or less. Num must be between 2 and 256.

#### buffer

Type: `buffer`

Buffer to optimize.


## License

MIT © [imagemin](https://github.com/imagemin)
