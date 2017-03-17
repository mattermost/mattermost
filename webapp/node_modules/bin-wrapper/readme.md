# bin-wrapper [![Build Status](http://img.shields.io/travis/kevva/bin-wrapper.svg?style=flat)](https://travis-ci.org/kevva/bin-wrapper)

> Binary wrapper that makes your programs seamlessly available as local dependencies


## Install

```
$ npm install --save bin-wrapper
```


## Usage

```js
var BinWrapper = require('bin-wrapper');

var base = 'https://github.com/imagemin/gifsicle-bin/raw/master/vendor';
var bin = new BinWrapper()
	.src(base + '/osx/gifsicle', 'darwin')
	.src(base + '/linux/x64/gifsicle', 'linux', 'x64')
	.src(base + '/win/x64/gifsicle.exe', 'win32', 'x64')
	.dest(path.join('vendor'))
	.use(process.platform === 'win32' ? 'gifsicle.exe' : 'gifsicle')
	.version('>=1.71');

bin.run(['--version'], function (err) {
	console.log('gifsicle is working');
});
```

Get the path to your binary with `bin.path()`:

```js
console.log(bin.path()); // => path/to/vendor/gifsicle
```


## API

### new BinWrapper(options)

Creates a new `BinWrapper` instance.

#### options.skipCheck

Type: `boolean`  
Default: `false`

Whether to skip the binary check or not.

#### options.strip

Type: `number`  
Default: `1`

Strip a number of leading paths from file names on extraction.

### .src(url, [os], [arch])

Adds a source to download.

#### url

Type: `string`

Accepts a URL pointing to a file to download.

#### os

Type: `string`

Tie the source to a specific OS.

#### arch

Type: `string`

Tie the source to a specific arch.

### .dest(dest)

#### dest

Type: `string`

Accepts a path which the files will be downloaded to.

### .use(bin)

#### bin

Type: `string`

Define which file to use as the binary.

### .path()

Returns the full path to your binary.

### .version(range)

#### range

Type: `string`

Define a [semver range](https://github.com/isaacs/node-semver#ranges) to check 
the binary against.

### .run([cmd], callback)

Runs the search for the binary. If no binary is found it will download the file 
using the URL provided in `.src()`.

#### cmd

Type: `array`  
Default: `['--version']`

Command to run the binary with. If it exits with code `0` it means that the 
binary is working.

#### callback(err)

Type: `function`

Returns nothing but a possible error.


## License

MIT © [Kevin Mårtensson](http://kevinmartensson.com)
