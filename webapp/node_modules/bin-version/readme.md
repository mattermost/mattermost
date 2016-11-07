# bin-version [![Build Status](https://travis-ci.org/sindresorhus/bin-version.svg?branch=master)](https://travis-ci.org/sindresorhus/bin-version)

> Get the version of a binary in [semver](https://github.com/isaacs/node-semver) format


## Install

```sh
$ npm install --save bin-version
```


## Usage

```sh
$ curl --version
curl 7.30.0 (x86_64-apple-darwin13.0)
```

```js
var binVersion = require('bin-version');

binVersion('curl', function (err, version) {
	console.log(version);
	//=> 7.30.0
});
```


## CLI

See the [find-versions](https://github.com/sindresorhus/find-versions#cli) CLI.


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
