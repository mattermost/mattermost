# lpad [![Build Status](https://travis-ci.org/sindresorhus/lpad.svg?branch=master)](https://travis-ci.org/sindresorhus/lpad)

> Left pad each line in a string

![](screenshot.png)


## Install

```
$ npm install --save lpad
```


## Usage

```js
var lpad = require('lpad');

var str = 'foo\nbar';
/*
foo
bar
*/

lpad(str, '    ');
/*
    foo
    bar
*/
```


## API

### lpad(string, pad)

Pads each line in a string with the supplied string.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
