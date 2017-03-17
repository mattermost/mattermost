# imagemin-svgo [![Build Status](https://travis-ci.org/imagemin/imagemin-svgo.svg?branch=master)](https://travis-ci.org/imagemin/imagemin-svgo) [![Build status](https://ci.appveyor.com/api/projects/status/esa7m3u8bcol1mtr/branch/master?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/imagemin-svgo/branch/master)

> [SVGO](https://github.com/svg/svgo) imagemin plugin


## Install

```
$ npm install --save imagemin-svgo
```


## Usage

```js
const imagemin = require('imagemin');
const imageminSvgo = require('imagemin-svgo');

imagemin(['images/*.svg'], 'build/images', {
	use: [
		imageminSvgo({
			plugins: [
				{removeViewBox: false}
			]
		})
	]
}).then(() => {
	console.log('Images optimized');
});
```


## API

### imageminSvgo([options])(buffer)

Returns a promise for a buffer.

#### options

Type: `object`

Pass options to [SVGO](https://github.com/svg/svgo#what-it-can-do).

#### buffer

Type: `buffer`

Buffer to optimize.


## License

MIT © [imagemin](https://github.com/imagemin)
