'use strict';

exports.__esModule = true;

var _cssColorNames = require('css-color-names');

var _cssColorNames2 = _interopRequireDefault(_cssColorNames);

var _toShorthand = require('./toShorthand');

var _toShorthand2 = _interopRequireDefault(_toShorthand);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

Object.keys(_cssColorNames2.default).forEach(function (c) {
  return _cssColorNames2.default[c] = (0, _toShorthand2.default)(_cssColorNames2.default[c]);
});
exports.default = _cssColorNames2.default;
module.exports = exports['default'];