# bin-build [![Build Status](https://travis-ci.org/kevva/bin-build.svg?branch=master)](https://travis-ci.org/kevva/bin-build)

> Easily build binaries


## Install

```
$ npm install --save bin-build
```


## Usage

```js
var BinBuild = require('bin-build');

var build = new BinBuild()
    .src('http://www.lcdf.org/gifsicle/gifsicle-1.80.tar.gz')
    .cmd('./configure --disable-gifview --disable-gifdiff')
    .cmd('make install');

build.run(function (err) {
    console.log('gifsicle built successfully');
});
```


## API

### new BinBuild(options)

Creates a new `BinBuild` instance.

#### options.strip

Type: `number`

Strip a number of leading paths from file names on extraction.

### .src(str)

#### str

Type: `string`

Accepts a URL to a archive containing the source code, a path to an archive or a 
path to a directory containing the source code.

### .cmd(str)

#### str

Type: `string`

Add a command to run when building.

### .run(callback)

#### callback(err)

Type: `function`

Runs the build and returns an error if something has gone wrong


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
