'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _evenValues = require('./evenValues');

var _evenValues2 = _interopRequireDefault(_evenValues);

var _getMatch = require('./getMatch');

var _getMatch2 = _interopRequireDefault(_getMatch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var keywords = [['ease', [0.25, 0.1, 0.25, 1]], ['linear', [0, 0, 1, 1]], ['ease-in', [0.42, 0, 1, 1]], ['ease-out', [0, 0, 0.58, 1]], ['ease-in-out', [0.42, 0, 0.58, 1]]];

var getValue = function getValue(node) {
    return parseFloat(node.value);
};
var getMatch = (0, _getMatch2.default)(keywords);

function reduce(node) {
    if (node.type !== 'function') {
        return false;
    }
    if (node.value === 'steps') {
        // Don't bother checking the step-end case as it has the same length
        // as steps(1)
        if (getValue(node.nodes[0]) === 1 && node.nodes[2] && node.nodes[2].value === 'start') {
            node.type = 'word';
            node.value = 'step-start';
            delete node.nodes;
            return;
        }
        // The end case is actually the browser default, so it isn't required.
        if (node.nodes[2] && node.nodes[2].value === 'end') {
            node.nodes = [node.nodes[0]];
            return;
        }
        return false;
    }
    if (node.value === 'cubic-bezier') {
        var match = getMatch(node.nodes.filter(_evenValues2.default).map(getValue));

        if (match.length) {
            node.type = 'word';
            node.value = match[0][0];
            delete node.nodes;
            return;
        }
    }
}

exports.default = (0, _postcss.plugin)('cssnano-reduce-timing-functions', function () {
    return function (css) {
        css.walkDecls(/(animation|transition)(-timing-function|$)/, function (decl) {
            decl.value = (0, _postcssValueParser2.default)(decl.value).walk(reduce).toString();
        });
    };
});
module.exports = exports['default'];