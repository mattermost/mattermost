# executable [![Build Status](http://img.shields.io/travis/kevva/executable.svg?style=flat)](https://travis-ci.org/kevva/executable)

> Check if a file is executable using Node.js


## Install

```
$ npm install --save executable
```


## Usage

```js
var executable = require('executable');

executable('bash', function (err, exec) {
	console.log(exec);
	//=> true
});

executable.sync('bash');
//=> true
```


## CLI

```
$ npm install --global executable
```

```
$ executable --help

  Usage
    $ executable <file>

  Example
    $ executable optipng
```


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
