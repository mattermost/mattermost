'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function reduceCalcWhitespaces(node) {
    if (node.type === 'space') {
        node.value = ' ';
    } else if (node.type === 'function') {
        node.before = node.after = '';
    }
}

function reduceWhitespaces(node) {
    if (node.type === 'space') {
        node.value = ' ';
    } else if (node.type === 'div') {
        node.before = node.after = '';
    } else if (node.type === 'function') {
        node.before = node.after = '';
        if (node.value === 'calc') {
            _postcssValueParser2.default.walk(node.nodes, reduceCalcWhitespaces);
            return false;
        }
    }
}

function transformDecls(decl) {
    if (!/filter/.test(decl.prop)) {
        decl.value = (0, _postcssValueParser2.default)(decl.value).walk(reduceWhitespaces).toString();
    }
}

exports.default = (0, _postcss.plugin)('cssnano-function-optimiser', function () {
    return function (css) {
        return css.walkDecls(transformDecls);
    };
});
module.exports = exports['default'];