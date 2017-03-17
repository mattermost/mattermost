'use strict';

var writeDir = require('./writeDir');
var writeStream = require('./writeStream');
var writeBuffer = require('./writeBuffer');
var writeSymbolicLink = require('./writeSymbolicLink');

function writeContents(writePath, file, callback) {
  // If directory then mkdirp it
  if (file.isDirectory()) {
    return writeDir(writePath, file, written);
  }

  // Stream it to disk yo
  if (file.isStream()) {
    return writeStream(writePath, file, written);
  }

  // Write it as a symlink
  if (file.symlink) {
    return writeSymbolicLink(writePath, file, written);
  }

  // Write it like normal
  if (file.isBuffer()) {
    return writeBuffer(writePath, file, written);
  }

  // If no contents then do nothing
  if (file.isNull()) {
    return written();
  }

  // This is invoked by the various writeXxx modules when they've finished
  // writing the contents.
  function written(err) {
    if (isErrorFatal(err)) {
      return callback(err);
    }

    callback(null, file);
  }

  function isErrorFatal(err) {
    if (!err) {
      return false;
    }

    if (err.code === 'EEXIST' && file.flag === 'wx') {
      // Handle scenario for file overwrite failures.
      return false;   // "These aren't the droids you're looking for"
    }

    // Otherwise, this is a fatal error
    return true;
  }
}

module.exports = writeContents;
