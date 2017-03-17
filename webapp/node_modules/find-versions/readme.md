# find-versions [![Build Status](https://travis-ci.org/sindresorhus/find-versions.svg?branch=master)](https://travis-ci.org/sindresorhus/find-versions)

> Find semver versions in a string: `unicorn 1.0.0` → `1.0.0`


## Install

```
$ npm install --save find-versions
```


## Usage

```js
var findVersions = require('find-versions');

findVersions('unicorn 1.0.0 rainbow v2.3.4+build.1');
//=> ['1.0.0', '2.3.4+build.1']

findVersions('cp (GNU coreutils) 8.22', {loose: true});
//=> ['8.22.0']
```


## API

### findVersions(input, options)

#### input

*Required*  
Type: `string`

#### options.loose

Type: `boolean`  
Default: `false`

Also match non-semver versions like `1.88`.  
They're coerced into semver compliant versions.


## CLI

```
$ npm install --global find-versions
```

```
$ find-versions --help

  Usage
    $ find-versions <string> [--first] [--loose]
    $ echo <string> | find-versions

  Example
    $ find-versions 'unicorns v1.2.3'
    1.2.3

    $ curl --version | find-versions --first
    7.30.0

  Options
    --first  Return the first match
    --loose  Match non-semver versions like 1.88
```


## License

MIT © [Sindre Sorhus](http://sindresorhus.com)
