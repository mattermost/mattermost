# imagemin-optipng [![Build Status](http://img.shields.io/travis/imagemin/imagemin-optipng.svg?style=flat)](https://travis-ci.org/imagemin/imagemin-optipng) [![Build status](https://ci.appveyor.com/api/projects/status/4e5msglic4m7yxst?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/imagemin-optipng)

> optipng image-min plugin


## Install

```
$ npm install --save imagemin-optipng
```


## Usage

```js
const imagemin = require('imagemin');
const imageminOptipng = require('imagemin-optipng');

imagemin(['images/*.png'], 'build/images', {use: [imageminOptipng()]}).then(() => {
	console.log('Images optimized');
});
```


## API

### imageminOptipng([options])(buffer)

Returns a `Promise` for a `Buffer`.

#### options

##### optimizationLevel

Type: `number`<br>
Default: `3`

Select an optimization level between `0` and `7`.

> The optimization level 0 enables a set of optimization operations that require minimal effort. There will be no changes to image attributes like bit depth or color type, and no recompression of existing IDAT datastreams. The optimization level 1 enables a single IDAT compression trial. The trial chosen is what. OptiPNG thinks it’s probably the most effective. The optimization levels 2 and higher enable multiple IDAT compression trials; the higher the level, the more trials.

Level and trials:

1. 1 trial
2. 8 trials
3. 16 trials
4. 24 trials
5. 48 trials
6. 120 trials
7. 240 trials

##### bitDepthReduction

Type: `boolean`<br>
Default: `true`

Apply bit depth reduction.

##### colorTypeReduction

Type: `boolean`<br>
Default: `true`

Apply color type reduction.

##### paletteReduction

Type: `boolean`<br>
Default: `true`

Apply palette reduction.

#### buffer

Type: `Buffer`

Buffer to optimize.


## License

MIT © [imagemin](https://github.com/imagemin)
