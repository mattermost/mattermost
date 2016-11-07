'use strict';

var fs = require('fs');
/**
 * Read the file and cache the result
 * return the result in cache
 *
 * @example
 * var read = require('./helpers/fsExists')({});
 * read('.babelrc'); // file contents...
 */
module.exports = function(cache) {
  cache = cache || {};

  return function(filename) {

    if (!filename) {
      throw new Error('filename must be a string');
    }

    cache[filename] = cache[filename] || fs.readFileSync(filename, 'utf8');

    return cache[filename];
  };
};
