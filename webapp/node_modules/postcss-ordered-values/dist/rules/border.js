'use strict';

exports.__esModule = true;
exports.default = normalizeBorder;

var _postcssValueParser = require('postcss-value-parser');

var _getParsed = require('../lib/getParsed');

var _getParsed2 = _interopRequireDefault(_getParsed);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// border: <line-width> || <line-style> || <color>
// outline: <outline-color> || <outline-style> || <outline-width>
var borderProps = ['border', 'border-top', 'border-right', 'border-bottom', 'border-left', 'outline'];

var borderWidths = ['thin', 'medium', 'thick'];

var borderStyles = ['none', 'auto', // only in outline-style
'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'];

function normalizeBorder(decl) {
    if (!~borderProps.indexOf(decl.prop)) {
        return;
    }
    var border = (0, _getParsed2.default)(decl);
    if (border.nodes.length > 2) {
        (function () {
            var order = { width: '', style: '', color: '' };
            var abort = false;
            border.walk(function (node) {
                if (node.type === 'comment' || node.type === 'function' && node.value === 'var') {
                    abort = true;
                    return false;
                }
                if (node.type === 'word') {
                    if (~borderStyles.indexOf(node.value)) {
                        order.style = node.value;
                        return false;
                    }
                    if (~borderWidths.indexOf(node.value) || (0, _postcssValueParser.unit)(node.value)) {
                        order.width = node.value;
                        return false;
                    }
                    order.color = node.value;
                    return false;
                }
                if (node.type === 'function') {
                    if (node.value === 'calc') {
                        order.width = (0, _postcssValueParser.stringify)(node);
                    } else {
                        order.color = (0, _postcssValueParser.stringify)(node);
                    }
                    return false;
                }
            });
            if (!abort) {
                decl.value = (order.width + ' ' + order.style + ' ' + order.color).trim();
            }
        })();
    }
};
module.exports = exports['default'];