# semver-regex [![Build Status](https://travis-ci.org/sindresorhus/semver-regex.svg?branch=master)](https://travis-ci.org/sindresorhus/semver-regex)

> Regular expression for matching [semver](https://github.com/isaacs/node-semver) versions


## Install

```sh
$ npm install --save semver-regex
```


## Usage

```js
var semverRegex = require('semver-regex');

semverRegex().test('v1.0.0');
//=> true

semverRegex().test('1.2.3-alpha.10.beta.0+build.unicorn.rainbow');
//=> true

semverRegex().exec('unicorn 1.0.0 rainbow')[0];
//=> 1.0.0

'unicorn 1.0.0 and rainbow 2.1.3'.match(semverRegex());
//=> ['1.0.0', '2.1.3']
```

*It's a function so you can create multiple instances. Regexes with the global flag will have the `.lastIndex` property changed for each call to methods on the instance. Therefore reusing the instance with multiple calls will not work as expected for `.test()`.*


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
