# promise-pipe
> "Performs left to right composition of one or more functions that returns a promise"


[![NPM][promise-pipe-icon]][promise-pipe-url]

## Install

```sh
$ npm install promise.pipe --save
```

## Usage

```js
var pipe = require('promise.pipe')
var addThree = pipe(addOne, addOne, addOne)

addThree(0)
  .then(console.log) // 3
  .catch(console.error)
```

## API

#### `pipe(callbacks..., or Array<callbacks>)` -> `promise`

Runs multiple promise-returning functions in a series, passing each result to the next defined promise-returning function.  

##### functions

*Required*
Type: `function -> Promise`  


[promise-pipe-icon]: https://nodei.co/npm/promise.pipe.png?downloads=true
[promise-pipe-url]: https://npmjs.org/package/promise.pipe
