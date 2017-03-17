# is-tar [![Build Status](https://travis-ci.org/kevva/is-tar.svg?branch=master)](https://travis-ci.org/kevva/is-tar)

> Check if a Buffer/Uint8Array is a TAR file

## Install

```sh
$ npm install --save is-tar
```

## Usage

```js
var isTar = require('is-tar');
var read = require('fs').readFileSync;

isTar(read('file.tar'));
// => true
```

## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
