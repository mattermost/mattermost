// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// test uncompressing invalid input

var tape = require('tape'),
    zlib = require('../');

tape('non-strings', function(t) {
  var nonStringInputs = [1, true, {a: 1}, ['a']];
  t.plan(12);

  nonStringInputs.forEach(function(input) {
    // zlib.gunzip should not throw an error when called with bad input.
    t.doesNotThrow(function() {
      zlib.gunzip(input, function(err, buffer) {
        // zlib.gunzip should pass the error to the callback.
        t.ok(err);
      });
    });
  });
});

tape('unzips', function(t) {
  // zlib.Unzip classes need to get valid data, or else they'll throw.
  var unzips = [ zlib.Unzip(),
                 zlib.Gunzip(),
                 zlib.Inflate(),
                 zlib.InflateRaw() ];
                 
  t.plan(4);
  unzips.forEach(function (uz, i) {
    uz.on('error', function(er) {
      t.ok(er);
    });

    uz.on('end', function(er) {
      throw new Error('end event should not be emitted '+uz.constructor.name);
    });

    // this will trigger error event
    uz.write('this is not valid compressed data.');
  });
});
