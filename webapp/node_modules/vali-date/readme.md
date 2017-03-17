# vali-date [![Build Status](https://travis-ci.org/SamVerschueren/vali-date.svg?branch=master)](https://travis-ci.org/SamVerschueren/vali-date)

> Validate a date.


## Install

```
$ npm install --save vali-date
```


## Usage

```js
const validate = require('vali-date');

validate('foo');
//=> false

validate('2015-12-15T12:00:00Z');
//=> true

validate('2015-12-15T12:00:00+01:00');
//=> true
```


## API

### validate(date)

Returns a boolean indicating if the date provided is valid or not.

#### date

Type: `string`

The date that should be validated.


## License

MIT © [Sam Verschueren](http://github.com/SamVerschueren)
