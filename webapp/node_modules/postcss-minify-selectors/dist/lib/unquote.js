'use strict';

exports.__esModule = true;

exports.default = function (string) {
  return string.replace(/["']/g, '');
};

module.exports = exports['default'];