'use strict';

var through2 = require('through2');
var fs = require('graceful-fs');
var prepareWrite = require('../prepareWrite');

function symlink(outFolder, opt) {
  function linkFile(file, enc, cb) {
    var srcPath = file.path;
    var symType = (file.isDirectory() ? 'dir' : 'file');
    prepareWrite(outFolder, file, opt, function(err, writePath) {
      if (err) {
        return cb(err);
      }
      fs.symlink(srcPath, writePath, symType, function(err) {
        if (err && err.code !== 'EEXIST') {
          return cb(err);
        }
        cb(null, file);
      });
    });
  }

  var stream = through2.obj(opt, linkFile);
  // TODO: option for either backpressure or lossy
  stream.resume();
  return stream;
}

module.exports = symlink;
