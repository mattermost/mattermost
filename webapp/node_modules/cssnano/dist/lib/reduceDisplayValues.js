'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _evenValues = require('./evenValues');

var _evenValues2 = _interopRequireDefault(_evenValues);

var _getMatch = require('./getMatch');

var _getMatch2 = _interopRequireDefault(_getMatch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Specification: https://drafts.csswg.org/css-display/#the-display-properties
 */

var mappings = [['block', ['block', 'flow']], ['flow-root', ['block', 'flow-root']], ['inline', ['inline', 'flow']], ['inline-block', ['inline', 'flow-root']], ['run-in', ['run-in', 'flow']], ['list-item', ['list-item', 'block', 'flow']], ['inline list-item', ['list-item', 'inline', 'flow']], ['flex', ['block', 'flex']], ['inline-flex', ['inline', 'flex']], ['grid', ['block', 'grid']], ['inline-grid', ['inline', 'grid']], ['ruby', ['inline', 'ruby']], ['table', ['block', 'table']], ['inline-table', ['inline', 'table']], ['table-cell', ['table-cell', 'flow']], ['table-caption', ['table-caption', 'flow']], ['ruby-base', ['ruby-base', 'flow']], ['ruby-text', ['ruby-text', 'flow']]];

var getMatch = (0, _getMatch2.default)(mappings);

function transform(node) {
    var _valueParser = (0, _postcssValueParser2.default)(node.value);

    var nodes = _valueParser.nodes;

    if (nodes.length === 1) {
        return;
    }
    var match = getMatch(nodes.filter(_evenValues2.default).map(function (n) {
        return n.value;
    }));
    if (match.length) {
        node.value = match[0][0];
    }
}

var plugin = _postcss2.default.plugin('cssnano-reduce-display-values', function () {
    return function (css) {
        return css.walkDecls('display', transform);
    };
});

plugin.mappings = mappings;

exports.default = plugin;
module.exports = exports['default'];