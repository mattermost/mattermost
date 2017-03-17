# filename-reserved-regex [![Build Status](https://travis-ci.org/sindresorhus/filename-reserved-regex.svg?branch=master)](https://travis-ci.org/sindresorhus/filename-reserved-regex)

> Regular expression for matching reserved filename characters

On Unix-like systems `/` is reserved and [`<>:"/\|?*`](http://msdn.microsoft.com/en-us/library/aa365247%28VS.85%29#naming_conventions) on Windows.


## Install

```
$ npm install --save filename-reserved-regex
```


## Usage

```js
var filenameReservedRegex = require('filename-reserved-regex');

filenameReservedRegex().test('foo/bar');
//=> false

filenameReservedRegex().test('foo-bar');
//=> true

'foo/bar'.replace(filenameReservedRegex(), '!');
//=> foo!bar
```


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
