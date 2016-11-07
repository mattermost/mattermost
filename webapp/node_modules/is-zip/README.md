# is-zip [![Build Status](https://travis-ci.org/kevva/is-zip.svg?branch=master)](https://travis-ci.org/kevva/is-zip)

> Check if a Buffer/Uint8Array is a ZIP file

## Install

```sh
$ npm install --save is-zip
```

## Usage

```js
var isZip = require('is-zip');
var read = require('fs').readFileSync;

isZip(read('foo.zip'));
// => true
```

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License) © [Kevin Mårtensson](https://github.com/kevva)
