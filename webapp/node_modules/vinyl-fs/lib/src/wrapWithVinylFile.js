'use strict';

var through2 = require('through2');
var fs = require('graceful-fs');
var File = require('vinyl');

function wrapWithVinylFile(options) {

  // A stat property is exposed on file objects as a (wanted) side effect
  function resolveFile(globFile, enc, cb) {
    fs.lstat(globFile.path, function(err, stat) {
      if (err) {
        return cb(err);
      }

      globFile.stat = stat;

      if (!stat.isSymbolicLink() || !options.followSymlinks) {
        var vinylFile = new File(globFile);
        if (globFile.originalSymlinkPath) {
          // If we reach here, it means there is at least one
          // symlink on the path and we need to rewrite the path
          // to its original value.
          // Updated file stats will tell getContents() to actually read it.
          vinylFile.path = globFile.originalSymlinkPath;
        }
        return cb(null, vinylFile);
      }

      fs.realpath(globFile.path, function(err, filePath) {
        if (err) {
          return cb(err);
        }

        if (!globFile.originalSymlinkPath) {
          // Store the original symlink path before the recursive call
          // to later rewrite it back.
          globFile.originalSymlinkPath = globFile.path;
        }
        globFile.path = filePath;

        // Recurse to get real file stat
        resolveFile(globFile, enc, cb);
      });
    });
  }

  return through2.obj(options, resolveFile);
}

module.exports = wrapWithVinylFile;
