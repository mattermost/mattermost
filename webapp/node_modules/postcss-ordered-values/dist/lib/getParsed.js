'use strict';

exports.__esModule = true;
exports.default = getParsed;

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getParsed(decl) {
    var value = decl.value;
    var raws = decl.raws;

    if (raws && raws.value && raws.value.raw) {
        value = raws.value.raw;
    }
    return (0, _postcssValueParser2.default)(value);
}
module.exports = exports['default'];