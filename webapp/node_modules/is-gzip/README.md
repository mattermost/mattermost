# is-gzip [![Build Status](https://travis-ci.org/kevva/is-gzip.svg?branch=master)](https://travis-ci.org/kevva/is-gzip)

> Check if a Buffer/Uint8Array is a GZIP file

## Install

```sh
$ npm install --save is-gzip
```

## Usage

```js
var isGzip = require('is-gzip');
var read = require('fs').readFileSync;

isGzip(read('foo.tar.gz'));
// => true
```

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License) © [Kevin Mårtensson](https://github.com/kevva)
