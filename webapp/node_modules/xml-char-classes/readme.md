# xml-char-classes [![Build Status](https://travis-ci.org/sindresorhus/xml-char-classes.svg?branch=master)](https://travis-ci.org/sindresorhus/xml-char-classes)

> Regular expressions for matching against the [XML Character Classes](http://www.w3.org/TR/2006/REC-xml-20060816/#CharClasses)


## Install

```sh
$ npm install --save xml-char-classes
```


## Usage

```js
var xmlCharClasses = require('xml-char-classes');

console.log(xmlCharClasses.digit);
//=> /[0-9\u0660-\u0669\u06F0-\u06F9\u0966-\u096F\u09E6-\u09EF\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0BE7-\u0BEF\u0C66-\u0C6F\u0CE6-\u0CEF\u0D66-\u0D6F\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F29]/

xmlCharClasses.letter.test('unicorn');
//=> true

xmlCharClasses.letter.test('#');
//=> false
```


## API

### xmlCharClasses

Contains the following regular expressions for matching the different [character classes](http://www.w3.org/TR/2006/REC-xml-20060816/#CharClasses) in the XML spec.

- letter
- baseChar
- ideographic
- combiningChar
- digit
- extender


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
