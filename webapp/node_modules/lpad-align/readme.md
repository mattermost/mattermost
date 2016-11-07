# lpad-align [![Build Status](http://img.shields.io/travis/kevva/lpad-align.svg?style=flat)](https://travis-ci.org/kevva/lpad-align)

> Left pad a string to align with the longest string in an array


## Install

```
$ npm install --save lpad-align
```


## Usage

```js
var lpadAlign = require('lpad-align');

var words = [
	'foo',
	'foobar',
	'foobarcat'
];

words.forEach(function (word) {
	console.log(lpadAlign(word, words, 4));
});

/*
		  foo
	   foobar
	foobarcat
 */
```


## CLI

```
$ npm install --global lpad-align
```

```
  Usage
    $ cat <file> | lpad-align

  Example
    $ cat unicorn.txt | lpad-align
          foo
       foobar
    foobarcat
```


## License

MIT © [Kevin Mårtensson](https://github.com/kevva)
