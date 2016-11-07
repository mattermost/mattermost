'use strict';

var fs = require('graceful-fs');
var mkdirp = require('mkdirp');

var fo = require('../../fileOperations');

function writeDir(writePath, file, written) {
  var mkdirpOpts = {
    mode: file.stat.mode,
    fs: fs,
  };
  mkdirp(writePath, mkdirpOpts, onMkdirp);

  function onMkdirp(mkdirpErr) {
    if (mkdirpErr) {
      return written(mkdirpErr);
    }

    fs.open(writePath, 'r', onOpen);
  }

  function onOpen(openErr, fd) {
    // If we don't have access, just move along
    if (isInaccessible(openErr)) {
      return fo.closeFd(null, fd, written);
    }

    if (openErr) {
      return fo.closeFd(openErr, fd, written);
    }

    fo.updateMetadata(fd, file, onUpdate);
  }

  function onUpdate(statErr, fd) {
    fo.closeFd(statErr, fd, written);
  }
}

function isInaccessible(err) {
    if (!err) {
      return false;
    }

    if (err.code === 'EACCES') {
      return true;
    }

    return false;
  }

module.exports = writeDir;
