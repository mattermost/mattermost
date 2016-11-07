'use strict';

/**
 * The purpose of this module, is to find the project's .babelrc and
 * use its contents to bust the babel-loader's internal cache whenever an option
 * changes.
 *
 * @see https://github.com/babel/babel-loader/issues/62
 * @see http://git.io/vLEvu
 */
var fs = require('fs');
var path = require('path');
var assign = require('object-assign');
var exists = require('./helpers/exists')({});
var read = require('./helpers/read')({});

var find = function find(start, rel) {
  var file = path.join(start, rel);
  var opts = {};
  var up = '';

  if (exists(file)) {
    return read(file);
  }

  up = path.dirname(start);
  if (up !== start) {
    // Reached root
    return find(up, rel);
  }

};

module.exports = function(loc, rel) {
  rel = rel || '.babelrc';
  return find(loc, rel);
};
