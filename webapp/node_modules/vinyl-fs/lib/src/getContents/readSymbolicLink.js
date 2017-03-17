'use strict';

var fs = require('graceful-fs');

function readLink(file, opt, cb) {
  fs.readlink(file.path, function(err, target) {
    if (err) {
      return cb(err);
    }

    // Store the link target path
    file.symlink = target;

    return cb(null, file);
  });
}

module.exports = readLink;
