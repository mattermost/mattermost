'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function filterOptimiser(decl) {
    decl.value = (0, _postcssValueParser2.default)(decl.value).walk(function (node) {
        if (node.type === 'function' || node.type === 'div' && node.value === ',') {
            node.before = node.after = '';
        }
    }).toString();
}

exports.default = (0, _postcss.plugin)('cssnano-filter-optimiser', function () {
    return function (css) {
        return css.walkDecls(/filter/, filterOptimiser);
    };
});
module.exports = exports['default'];