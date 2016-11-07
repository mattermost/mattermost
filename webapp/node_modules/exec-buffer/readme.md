# exec-buffer [![Build Status](http://img.shields.io/travis/kevva/exec-buffer.svg?style=flat)](https://travis-ci.org/kevva/exec-buffer)

> Run a buffer through a child process


## Install

```
$ npm install --save exec-buffer
```


## Usage

```js
const fs = require('fs');
const execBuffer = require('exec-buffer');
const gifsicle = require('gifsicle').path;

execBuffer({
	input: fs.readFileSync('test.gif'),
	bin: gifsicle,
	args: ['-o', execBuffer.output, execBuffer.input]
}).then(data => {
	console.log(data);
	//=> <Buffer 47 49 46 38 37 61 ...>
});
```


## API

### execBuffer(options)

#### options

##### input

Type: `buffer`

The `buffer` to be ran through the child process.

##### bin

Type: `string`

Path to the binary.

##### args

Type: `array`

Arguments to run the binary with.

### execBuffer.input

Returns a temporary path to where the input file will be written.

### execBuffer.output

Returns a temporary path to where the output file will be written.


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
