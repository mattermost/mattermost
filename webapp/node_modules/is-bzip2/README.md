# is-bzip2 [![Build Status](https://travis-ci.org/kevva/is-bzip2.svg?branch=master)](https://travis-ci.org/kevva/is-bzip2)

> Check if a Buffer/Uint8Array is a BZIP2 file

## Install

```sh
$ npm install --save is-bzip2
```

## Usage

```js
var isBzip2 = require('is-bzip2');
var read = require('fs').readFileSync;

isBzip2(read('foo.bz2'));
// => true
```

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License) © [Kevin Mårtensson](https://github.com/kevva)
