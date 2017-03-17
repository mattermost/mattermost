'use strict';

var fs = require('graceful-fs');

function writeSymbolicLink(writePath, file, written) {
  // TODO handle symlinks properly
  fs.symlink(file.symlink, writePath, function(err) {
    if (isFatalError(err)) {
      return written(err);
    }

    written();
  });
}

function isFatalError(err) {
  return (err && err.code !== 'EEXIST');
}

module.exports = writeSymbolicLink;
