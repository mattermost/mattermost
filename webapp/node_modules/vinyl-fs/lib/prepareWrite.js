'use strict';

var assign = require('object-assign');
var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('graceful-fs');

function booleanOrFunc(v, file) {
  if (typeof v !== 'boolean' && typeof v !== 'function') {
    return null;
  }

  return typeof v === 'boolean' ? v : v(file);
}

function stringOrFunc(v, file) {
  if (typeof v !== 'string' && typeof v !== 'function') {
    return null;
  }

  return typeof v === 'string' ? v : v(file);
}

function prepareWrite(outFolder, file, opt, cb) {
  var options = assign({
    cwd: process.cwd(),
    mode: (file.stat ? file.stat.mode : null),
    dirMode: null,
    overwrite: true,
  }, opt);
  var overwrite = booleanOrFunc(options.overwrite, file);
  options.flag = (overwrite ? 'w' : 'wx');

  var cwd = path.resolve(options.cwd);
  var outFolderPath = stringOrFunc(outFolder, file);
  if (!outFolderPath) {
    throw new Error('Invalid output folder');
  }
  var basePath = options.base ?
    stringOrFunc(options.base, file) : path.resolve(cwd, outFolderPath);
  if (!basePath) {
    throw new Error('Invalid base option');
  }

  var writePath = path.resolve(basePath, file.relative);
  var writeFolder = path.dirname(writePath);

  // Wire up new properties
  file.stat = (file.stat || new fs.Stats());
  file.stat.mode = options.mode;
  file.flag = options.flag;
  file.cwd = cwd;
  file.base = basePath;
  file.path = writePath;

  // Mkdirp the folder the file is going in
  var mkdirpOpts = {
    mode: options.dirMode,
    fs: fs,
  };
  mkdirp(writeFolder, mkdirpOpts, function(err) {
    if (err) {
      return cb(err);
    }
    cb(null, writePath);
  });
}

module.exports = prepareWrite;
