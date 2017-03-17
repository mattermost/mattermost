# bin-check [![Build Status](https://travis-ci.org/kevva/bin-check.svg?branch=master)](https://travis-ci.org/kevva/bin-check)

> Check if a binary is working by checking its exit code


## Install

```
$ npm install --save bin-check
```


## Usage

```js
var binCheck = require('bin-check');

binCheck('/bin/sh', ['--version'], function (err, works) {
	console.log(works);
	//=> true
});
```


## API

### binCheck(binary, command, callback)

#### binary

Type: `string`

Path to the binary.

#### command

Type: `array`  
Default: `['--help']`

Commands to run the binary with.

#### callback(err, works)

Type: `function`

`works` is a `boolean` which returns `true` if the binary is working correctly.


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
