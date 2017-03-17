'use strict';

var fs = require('graceful-fs');
var stripBom = require('strip-bom-stream');
var lazystream = require('lazystream');

function streamFile(file, opt, cb) {
  if (typeof opt === 'function') {
    cb = opt;
    opt = {};
  }

  var filePath = file.path;

  file.contents = new lazystream.Readable(function() {
    return fs.createReadStream(filePath);
  });

  if (opt.stripBOM) {
    file.contents = file.contents.pipe(stripBom());
  }

  cb(null, file);
}

module.exports = streamFile;
