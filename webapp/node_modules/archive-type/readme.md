# archive-type [![Build Status](https://travis-ci.org/kevva/archive-type.svg?branch=master)](https://travis-ci.org/kevva/archive-type)

> Detect the archive type of a Buffer/Uint8Array

*See [archive-type-cli](https://github.com/kevva/archive-type-cli) for the command-line version.*


## Install

```
$ npm install --save archive-type
```


## Usage

```js
var readFileSync = require('fs').readFileSync;
var archiveType = require('archive-type');

archiveType(readFileSync('foo.zip'));
//=> {ext: 'zip', mime: 'application/zip'}
```


## API

### archiveType(buf)

Returns [`7z`](https://github.com/kevva/is-7zip), [`bz2`](https://github.com/kevva/is-bzip2), [`gz`](https://github.com/kevva/is-gzip), [`rar`](https://github.com/kevva/is-rar), [`tar`](https://github.com/kevva/is-tar), [`zip`](https://github.com/kevva/is-zip), [`xz`](https://github.com/kevva/is-xz) or `false`.

#### buf

Type: `buffer` *(Node.js)*, `uint8array`

It only needs the first 261 bytes.


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
