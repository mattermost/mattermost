# sum-up

[![NPM version](https://img.shields.io/npm/v/sum-up.svg)](https://www.npmjs.com/package/sum-up)
[![Build Status](https://travis-ci.org/shinnn/sum-up.svg?branch=master)](https://travis-ci.org/shinnn/sum-up)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/sum-up.svg)](https://coveralls.io/r/shinnn/sum-up)
[![Dependency Status](https://david-dm.org/shinnn/sum-up.svg)](https://david-dm.org/shinnn/sum-up)
[![devDependency Status](https://david-dm.org/shinnn/sum-up/dev-status.svg)](https://david-dm.org/shinnn/sum-up#info=devDependencies)

Summarize package information

```javascript
const sumUp = require('sum-up');
console.log(sumUp(require('./package.json')));
```

![Screenshot](./screenshot.png "Screenshot")

It helps your CLI tool to display information with `--help` flag.

## Installation

[Use npm.](https://docs.npmjs.com/cli/install)

```
npm install sum-up
```

## API

```javascript
const sumUp = require('sum-up');
```

### sumUp(*options*)

*options*: `Object`  
Return: `String`

It joins the `name`, `version`, `homepage` and `description` of the object (all is optional) into a string colorized with [ANSI escape code](https://github.com/sindresorhus/ansi-styles).

#### options.color

Type: `Boolean`  
Default: `true` if [the environment supports color](https://github.com/sindresorhus/supports-color), otherwise `false`

`false` omits all ANSI escape code from the string.

```javascript
let data = {
  name: 'cli-name',
  version: '0.6.11',
  description: 'My CLI tool.'
}

sumUp(data); //=> '\u001b[36mcli-name\u001b[39m \u001b[90mv0.6.11\u001b[39m\nMy CLI tool.'

data.color = false;

sumUp(data); //=> 'cli-name v0.6.11\nMy CLI tool.'
```

## License

Copyright (c) 2014 - 2016 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).
