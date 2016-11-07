# path-exists [![Build Status](https://travis-ci.org/sindresorhus/path-exists.svg?branch=master)](https://travis-ci.org/sindresorhus/path-exists)

> Check if a path exists

Because [`fs.exists()`](https://nodejs.org/api/fs.html#fs_fs_exists_path_callback) is being [deprecated](https://github.com/iojs/io.js/issues/103), but there's still a genuine use-case of being able to check if a path exists for other purposes than doing IO with it.

Never use this before handling a file though:

> In particular, checking if a file exists before opening it is an anti-pattern that leaves you vulnerable to race conditions: another process may remove the file between the calls to `fs.exists()` and `fs.open()`. Just open the file and handle the error when it's not there.


## Install

```
$ npm install --save path-exists
```


## Usage

```js
// foo.js
var pathExists = require('path-exists');

pathExists.sync('foo.js');
//=> true
```


## API

### pathExists(path, callback)

#### path

*Required*  
Type: `string`

#### callback(error, exists)

*Required*  
Type: `function`

##### exists

Type: `boolean`

### pathExists.sync(path)

Returns a boolean of whether the path exists.

#### path

*Required*  
Type: `string`


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
