# strip-outer [![Build Status](https://travis-ci.org/sindresorhus/strip-outer.svg?branch=master)](https://travis-ci.org/sindresorhus/strip-outer)

> Strip a substring from the start/end of a string


## Install

```
$ npm install --save strip-outer
```


## Usage

```js
var stripOuter = require('strip-outer');

stripOuter('foobarfoo', 'foo');
//=> bar

stripOuter('unicorncake', 'unicorn');
//=> cake
```


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
