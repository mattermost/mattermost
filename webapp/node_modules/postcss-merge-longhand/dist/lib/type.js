'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

exports['default'] = function (node) {
    return (0, _postcssValueParser2['default'])(node.value).nodes[0].type;
};

module.exports = exports['default'];