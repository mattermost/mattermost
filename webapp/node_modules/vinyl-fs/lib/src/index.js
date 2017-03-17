'use strict';

var assign = require('object-assign');
var through2 = require('through2');
var gs = require('glob-stream');
var duplexify = require('duplexify');
var merge = require('merge-stream');
var sourcemaps = require('gulp-sourcemaps');
var filterSince = require('../filterSince');
var isValidGlob = require('is-valid-glob');

var getContents = require('./getContents');
var wrapWithVinylFile = require('./wrapWithVinylFile');

function src(glob, opt) {
  var options = assign({
    read: true,
    buffer: true,
    stripBOM: true,
    sourcemaps: false,
    passthrough: false,
    followSymlinks: true,
  }, opt);

  // Don't pass `read` option on to through2
  var read = options.read !== false;
  options.read = undefined;

  var inputPass;

  if (!isValidGlob(glob)) {
    throw new Error('Invalid glob argument: ' + glob);
  }

  var globStream = gs.create(glob, options);

  var outputStream = globStream
    .pipe(wrapWithVinylFile(options));

  if (options.since != null) {
    outputStream = outputStream
      .pipe(filterSince(options.since));
  }

  if (read) {
    outputStream = outputStream
      .pipe(getContents(options));
  }

  if (options.passthrough === true) {
    inputPass = through2.obj(options);
    outputStream = duplexify.obj(inputPass, merge(outputStream, inputPass));
  }
  if (options.sourcemaps === true) {
    outputStream = outputStream
      .pipe(sourcemaps.init({ loadMaps: true }));
  }
  globStream.on('error', outputStream.emit.bind(outputStream, 'error'));
  return outputStream;
}

module.exports = src;
