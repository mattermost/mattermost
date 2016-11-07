'use strict';

var path = require('path');
var extend = require('extend-shallow');

module.exports = function(glob, options) {
  var opts = extend({}, options);
  opts.cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();

  // store first and last characters before glob is modified
  var prefix = glob.charAt(0);
  var suffix = glob.slice(-1);

  var isNegative = prefix === '!';
  if (isNegative) glob = glob.slice(1);

  if (opts.root && glob.charAt(0) === '/') {
    glob = path.join(path.resolve(opts.root), '.' + glob);
  } else {
    glob = path.resolve(opts.cwd, glob);
  }

  if (suffix === '/' && glob.slice(-1) !== '/') {
    glob += '/';
  }

  return isNegative ? '!' + glob : glob;
};
