'use strict';

var fs = require('graceful-fs');
var stripBom = require('strip-bom');

function bufferFile(file, opt, cb) {
  fs.readFile(file.path, function(err, data) {
    if (err) {
      return cb(err);
    }

    if (opt.stripBOM) {
      file.contents = stripBom(data);
    } else {
      file.contents = data;
    }

    cb(null, file);
  });
}

module.exports = bufferFile;
