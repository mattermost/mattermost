# bin-version-check [![Build Status](https://travis-ci.org/sindresorhus/bin-version-check.svg?branch=master)](https://travis-ci.org/sindresorhus/bin-version-check)

> Check whether a binary version satisfies a [semver range](https://github.com/isaacs/node-semver#ranges)

Useful when you have a thing that only works with specific versions of a binary.


## Install

```sh
$ npm install --save bin-version-check
```


## Usage

```sh
$ curl --version
curl 7.30.0 (x86_64-apple-darwin13.0)
```

```js
var binVersionCheck = require('bin-version-check');

binVersionCheck('curl', '>=8', function (err) {
	if (err) {
		throw err;
		//=> InvalidBinVersion: curl 7.30.0 does not satisfy the version requirement of >=8
	}
});
```


## CLI

```sh
$ npm install --global bin-version-check
```

```
$ bin-version-check --help

  Usage
    bin-version-check <binary> <semver-range>

  Example
    $ curl --version
    curl 7.30.0 (x86_64-apple-darwin13.0)
    $ bin-version-check curl '>=8'
    curl 7.30.0 does not satisfy the version requirement of >=8

  Exits with code 0 if the semver range is satisfied and 1 if not
```


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
