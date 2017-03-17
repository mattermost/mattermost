# exec-series

[![NPM version](https://img.shields.io/npm/v/exec-series.svg)](https://www.npmjs.com/package/exec-series)
[![Build Status](https://travis-ci.org/shinnn/exec-series.svg?branch=master)](https://travis-ci.org/shinnn/exec-series)
[![Build status](https://ci.appveyor.com/api/projects/status/bi4pflltlq5368ym?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/exec-series)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/exec-series.svg)](https://coveralls.io/r/shinnn/exec-series)
[![Dependency Status](https://david-dm.org/shinnn/exec-series.svg)](https://david-dm.org/shinnn/exec-series)
[![devDependency Status](https://david-dm.org/shinnn/exec-series/dev-status.svg)](https://david-dm.org/shinnn/exec-series#info=devDependencies)

A [Node](https://nodejs.org/) module to run commands in order

```javascript
const execSeries = require('exec-series');

execSeries(['echo "foo"', 'echo "bar"'], (err, stdouts, stderrs) => {
  if (err) {
    throw err;
  }

  console.log(stdouts); // yields: ['foo\n', 'bar\n']
  console.log(stderrs); // yields: ['', '']
});
```

On Linux, you can do almost the same thing with [`&&`](http://tldp.org/LDP/abs/html/list-cons.html#LISTCONSREF) operator like below:

```javascript
const {exec} = require('child_process');

exec('echo "foo" && echo "bar"', (err, stdout, stderr) => {
  //...
});
```

However, some environments, such as [Windows PowerShell](https://connect.microsoft.com/PowerShell/feedback/details/778798/implement-the-and-operators-that-bash-has), don't support `&&` operator. This module helps you to [create a cross-platform Node program](https://gist.github.com/domenic/2790533).

## Installation

[Use npm.](https://docs.npmjs.com/cli/install)

```
npm install exec-series
```

## API

```javascript
const execSeries = require('exec-series');
```

### execSeries(*commands* [, *options*, *callback*])

*commands*: `Array` of `String` (the commands to run)  
*options*: `Object` ([child_process.exec][exec] options with `maxBuffer` defaulting to 10 MB)  
*callback*: `Function`

It sequentially runs the commands using [child_process.exec][exec]. If the first command has finished successfully, the second command will run, and so on.

After the last command has finished, it runs the callback function.

When one of the commands fails, it immediately calls the callback function and the rest of the commands won't be run.

#### callback(*error*, *stdoutArray*, *stderrArray*)

*error*: `Error` if one of the commands fails, otherwise `undefined`  
*stdoutArray*: `Array` of `String` (stdout of the commands)  
*stderrArray*: `Array` of `String` (stderr of the commands)

```javascript
execSeries([
  'mkdir foo',
  'echo bar',
  'exit 200',
  'mkdir baz'
], (err, stdouts, stderrs) => {
  err.code; //=> 200
  stdouts; //=> ['', 'bar\n', '']
  stderrs; //=> ['', '', '']
  
  fs.statSync('foo').isDirectory; //=> true
  fs.statSync('baz'); // throw an error
});
```

Callback function is optional.

```javascript
execSeries(['mkdir foo', 'mkdir bar']);

setTimeout(() => {
  fs.statSync('foo').isDirectory(); //=> true
  fs.statSync('bar').isDirectory(); //=> true
}, 1000);
```

## License

Copyright (c) 2014 - 2016 [Shinnosuke Watanabe](https://github.com/shinnn)

Licensed under [the MIT License](./LICENSE).

[exec]: https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
