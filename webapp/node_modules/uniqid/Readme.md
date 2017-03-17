![uniqid logo](http://i.imgur.com/OrZC1lc.png)

![unqiid npm badge](http://img.shields.io/npm/v/uniqid.svg) ![uniqid npm downloads badge](https://img.shields.io/npm/dm/uniqid.svg) 

### A Unique Hexatridecimal ID generator. 
It will always create unique id's based on the current time, process and machine name.

```
npm install uniqid
```

## Usage
```js
var uniqid = require('uniqid');

console.log(uniqid()); // -> 4n5pxq24kpiob12og9
console.log(uniqid(), uniqid()); // -> 4n5pxq24kriob12ogd, 4n5pxq24ksiob12ogl
```

## Features
- Very fast
- Generates unique id's on multiple processes and machines even if called at the same time.
- Shorter 8 and 12 byte versions with less uniqueness.


# How it works
- With the current time the ID's are always unique in a single process.
- With the Process ID the ID's are unique even if called at the same time from multiple processes.
- With the MAC Address the ID's are unique even if called at the same time from multiple machines and processes.

## API:
####  **uniqid(** prefix *optional string* **)** 
Generate 18 byte unique id's based on the time, process id and mac address. Works on multiple processes and machines. 

```js
uniqid() -> "4n5pxq24kpiob12og9"
uniqid('hello-') -> "hello-4n5pxq24kpiob12og9"
```

####  **uniqid.process(** prefix *optional string* **)** 
Generate 12 byte unique id's based on the time and the process id. Works on multiple processes within a single machine but not on multiple machines.
```js
uniqid.process() -> "24ieiob0te82"
```

####  **uniqid.time(** prefix *optional string* **)** 
Generate 8 byte unique id's based on the current time only. Recommended only on a single process on a single machine.

```js
uniqid.time() -> "iob0ucoj"
```

## Webpack and Browserify
Since browsers don't provide a Process ID and in most cases neither give a Mac Address using uniqid from Webpack and Browserify falls back to `uniqid.time()` for all the other methods too. The browser is the single process, single machine case anyway.

## Debug
Debug messages are turned of by default as of `v4.1.0`. To turn on debug messages you'll need to set `uniqid_debug` to `true` before you require the module.

```js
// enable debug messages
module.uniqid_debug = true

// require the module
var uniqid = require('uniqid')
```

## **License**

(The MIT License)

Copyright (c) 2014 Halász Ádám <mail@adamhalasz.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
