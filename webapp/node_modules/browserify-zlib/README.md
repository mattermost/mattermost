# browserify-zlib

Emulates Node's [zlib](http://nodejs.org/api/zlib.html) module for [Browserify](http://browserify.org)
using [pako](https://github.com/nodeca/pako). It uses the actual Node source code and passes the Node zlib tests
by emulating the C++ binding that actually calls zlib.

[![browser support](https://ci.testling.com/devongovett/browserify-zlib.png)
](https://ci.testling.com/devongovett/browserify-zlib)

[![node tests](https://travis-ci.org/devongovett/browserify-zlib.svg)
](https://travis-ci.org/devongovett/browserify-zlib)

## Not implemented

The following options/methods are not supported because pako does not support them yet.

* The `params` method
* The `dictionary` option

## License

MIT
