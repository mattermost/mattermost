# is-gif [![Build Status](https://travis-ci.org/sindresorhus/is-gif.svg?branch=master)](https://travis-ci.org/sindresorhus/is-gif)

> Check if a Buffer/Uint8Array is a [GIF](http://en.wikipedia.org/wiki/Graphics_Interchange_Format) image

Used by [image-type](https://github.com/sindresorhus/image-type).


## Install

```sh
$ npm install --save is-gif
```


## Usage

##### Node.js

```js
var readChunk = require('read-chunk'); // npm install read-chunk
var isGif = require('is-gif');
var buffer = readChunk.sync('unicorn.gif', 0, 3);

isGif(buffer);
//=> true
```

##### Browser

```js
var xhr = new XMLHttpRequest();
xhr.open('GET', 'unicorn.gif');
xhr.responseType = 'arraybuffer';

xhr.onload = function () {
	isGif(new Uint8Array(this.response));
	//=> true
};

xhr.send();
```


## API

### isGif(buffer)

Accepts a Buffer (Node.js) or Uint8Array.

It only needs the first 3 bytes.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
