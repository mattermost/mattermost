/*!
 * exec-series | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/exec-series
*/

'use strict';

var exec = require('child_process').exec;

var eachSeries = require('async-each-series');
var objectAssign = require('object-assign');

var TEN_MEBIBYTE = 1024 * 1024 * 10;

module.exports = function execSeries(commands, options, cb) {
  if (!Array.isArray(commands)) {
    throw new TypeError(
      commands +
      ' is not an array. First argument must be an array of strings.'
    );
  }

  if (cb === undefined) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }
  } else if (typeof cb !== 'function') {
    throw new TypeError(
      cb +
      ' is not a function. Last argument must be a function.'
    );
  }

  var stdouts = [];
  var stderrs = [];

  eachSeries(commands, function(command, next) {
    exec(command, objectAssign({maxBuffer: TEN_MEBIBYTE}, options), function(err, stdout, stderr) {
      stdouts.push(stdout);
      stderrs.push(stderr);
      next(err);
    });
  }, function(err) {
    if (cb) {
      cb(err || null, stdouts, stderrs);
    }
  });
};
