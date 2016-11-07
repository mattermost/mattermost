'use strict';

exports.__esModule = true;

exports.default = function (str) {
  return str.replace(/([^\d])0(\.\d*)/g, '$1$2');
};

module.exports = exports['default'];