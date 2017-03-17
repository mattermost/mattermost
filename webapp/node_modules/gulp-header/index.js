/* jshint node: true */
'use strict';

/**
* Module dependencies.
*/

var Concat = require('concat-with-sourcemaps');
var extend = require('object-assign');
var through = require('through2');
var gutil = require('gulp-util');
var stream = require('stream');
var path = require('path');
var fs = require('fs');

/**
* gulp-header plugin
*/

module.exports = function (headerText, data) {
  headerText = headerText || '';

  function TransformStream(file, enc, cb) {
    // direct support for gulp-data
    if (file.data) {
      data = extend(file.data, data);
    }

    // format template
    var filename = path.basename(file.path);
    var template = data === false ? headerText : gutil.template(headerText, extend({ file: file, filename: filename }, data));

    if (file && typeof file === 'string') {
      this.push(template + file);
      return cb();
    }

    // if not an existing file, passthrough
    if (!isExistingFile(file)) {
      this.push(file);
      return cb();
    }

    // handle file stream;
    if (file.isStream()) {
      var stream = through();
      stream.write(new Buffer(template));
      stream.on('error', this.emit.bind(this, 'error'));
      file.contents = file.contents.pipe(stream);
      this.push(file);
      return cb();
    }

    // variables to handle direct file content manipulation
    var concat = new Concat(true, filename);

    // add template
    concat.add(null, new Buffer(template));

    // add sourcemap
    concat.add(file.relative, file.contents, file.sourceMap);

    // make sure streaming content is preserved
    if (file.contents && !isStream(file.contents)) {
      file.contents = concat.content;
    }

    // apply source map
    if (concat.sourceMapping) {
      file.sourceMap = JSON.parse(concat.sourceMap);
    }

    // make sure the file goes through the next gulp plugin
    this.push(file);

    // tell the stream engine that we are done with this file
    cb();
  }

  return through.obj(TransformStream);
};

/**
* is stream?
*/
function isStream(obj) {
  return obj instanceof stream.Stream;
}

/**
 * Is File, and Exists
 */
function isExistingFile(file) {
  try {
    if (!(file && typeof file === 'object')) return false;
    if (file.isDirectory()) return false;
    if (file.isStream()) return true;
    if (file.isBuffer()) return true;
    if (typeof file.contents === 'string') return true;
  } catch(err) {}
  return false;
}
