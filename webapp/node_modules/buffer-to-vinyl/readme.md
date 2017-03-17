# buffer-to-vinyl [![Build Status](http://img.shields.io/travis/kevva/buffer-to-vinyl.svg?style=flat)](https://travis-ci.org/kevva/buffer-to-vinyl)

> Create a vinyl file or stream from a buffer


## Install

```
$ npm install --save buffer-to-vinyl
```


## Usage

```js
var bufferToVinyl = require('buffer-to-vinyl');
var fs = require('fs');

bufferToVinyl.file(fs.readFileSync('foo.jpg', null));
bufferToVinyl.stream(fs.readFileSync('foo.jpg', null));
```


## API

### .file(buf, [name])

Creates a vinyl file.

### .stream(buf, [name])

Creates a object stream.


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
