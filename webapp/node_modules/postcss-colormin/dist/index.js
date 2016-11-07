'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssValueParser = require('postcss-value-parser');

var _postcssValueParser2 = _interopRequireDefault(_postcssValueParser);

var _colormin = require('colormin');

var _colormin2 = _interopRequireDefault(_colormin);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function reduceWhitespaces(decl) {
    decl.value = (0, _postcssValueParser2.default)(decl.value).walk(function (node) {
        if (node.type === 'function' || node.type === 'div') {
            node.before = node.after = '';
        }
    }).toString();
}

function walk(parent, callback) {
    parent.nodes.forEach(function (node, index) {
        var bubble = callback(node, index, parent);
        if (node.nodes && bubble !== false) {
            walk(node, callback);
        }
    });
}

function transform(decl, opts) {
    if (decl.prop === '-webkit-tap-highlight-color') {
        if (decl.value === 'inherit' || decl.value === 'transparent') {
            return;
        }
        reduceWhitespaces(decl);
        return;
    }
    if (/^(font|filter)/.test(decl.prop)) {
        return;
    }
    var ast = (0, _postcssValueParser2.default)(decl.value);
    walk(ast, function (node, index, parent) {
        if (node.type === 'function') {
            if (/^(rgb|hsl)a?$/.test(node.value)) {
                var value = node.value;

                node.value = (0, _colormin2.default)((0, _postcssValueParser.stringify)(node), opts);
                node.type = 'word';
                var next = parent.nodes[index + 1];
                if (node.value !== value && next && next.type === 'word') {
                    parent.nodes.splice(index + 1, 0, { type: 'space', value: ' ' });
                }
            } else if (node.value === 'calc') {
                return false;
            }
        } else {
            node.value = (0, _colormin2.default)(node.value, opts);
        }
    });
    decl.value = ast.toString();
}

exports.default = _postcss2.default.plugin('postcss-colormin', function () {
    var opts = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    return function (css) {
        return css.walkDecls(function (node) {
            return transform(node, opts);
        });
    };
});
module.exports = exports['default'];