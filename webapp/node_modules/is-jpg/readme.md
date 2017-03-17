# is-jpg [![Build Status](https://travis-ci.org/sindresorhus/is-jpg.svg?branch=master)](https://travis-ci.org/sindresorhus/is-jpg)

> Check if a Buffer/Uint8Array is a [JPEG](http://en.wikipedia.org/wiki/JPEG) image

Used by [image-type](https://github.com/sindresorhus/image-type).


## Install

```sh
$ npm install --save is-jpg
```


## Usage

##### Node.js

```js
var readChunk = require('read-chunk'); // npm install read-chunk
var isJpg = require('is-jpg');
var buffer = readChunk.sync('unicorn.jpg', 0, 3);

isJpg(buffer);
//=> true
```

##### Browser

```js
var xhr = new XMLHttpRequest();
xhr.open('GET', 'unicorn.jpg');
xhr.responseType = 'arraybuffer';

xhr.onload = function () {
	isJpg(new Uint8Array(this.response));
	//=> true
};

xhr.send();
```


## API

### isJpg(buffer)

Accepts a Buffer (Node.js) or Uint8Array.

It only needs the first 3 bytes.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
