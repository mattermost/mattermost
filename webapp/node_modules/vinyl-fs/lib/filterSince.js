'use strict';

var filter = require('through2-filter');

module.exports = function(d) {
  var isValid = typeof d === 'number' ||
    d instanceof Number ||
    d instanceof Date;

  if (!isValid) {
    throw new Error('expected since option to be a date or a number');
  }
  return filter.obj(function(file) {
    return file.stat && file.stat.mtime > d;
  });
};
