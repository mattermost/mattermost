# async-each-series

  Apply an async function to each Array element in series

  [![Build Status](https://travis-ci.org/jb55/async-each-series.svg)](https://travis-ci.org/jb55/async-each-series)

  [![browser support](https://ci.testling.com/jb55/async-each-series.png)](https://ci.testling.com/jb55/async-each-series)

## Installation

  Install with [npm](https://www.npmjs.org):

    $ npm install async-each-series

  Install with [component(1)](http://component.io):

    $ component install jb55/async-each-series

## Examples

### Node.js

```javascript
var each = require('async-each-series');
each(['foo','bar','baz'], function(el, next) {
  setTimeout(function () {
    console.log(el);
    next();
  }, Math.random() * 5000);
}, function (err) {
  console.log('finished');
});
//=> foo
//=> bar
//=> baz
//=> finished
```

## API

### eachSeries(array, iterator(elem, cb(err, elem)), finishedCb(err))

## License

  The MIT License (MIT)

  Copyright (c) 2014 William Casarin

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
