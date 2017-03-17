'use strict';
Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _postcss = require('postcss');

var _postcssValueParserLibUnit = require('postcss-value-parser/lib/unit');

var _postcssValueParserLibUnit2 = _interopRequireDefault(_postcssValueParserLibUnit);

var _clone = require('../clone');

var _clone2 = _interopRequireDefault(_clone);

var _getLastNode = require('../getLastNode');

var _getLastNode2 = _interopRequireDefault(_getLastNode);

var wc = ['column-width', 'column-count'];

exports['default'] = {
    explode: function explode(rule) {
        rule.walkDecls('columns', function (decl) {
            var values = _postcss.list.space(decl.value).sort();
            if (values.length === 1) {
                values.push('auto');
            }

            values.forEach(function (value, i) {
                var name = 'column-count';

                if (value === 'auto') {
                    name = i === 0 ? 'column-width' : 'column-count';
                } else if ((0, _postcssValueParserLibUnit2['default'])(value).unit !== '') {
                    name = 'column-width';
                }

                var prop = (0, _clone2['default'])(decl);
                prop.prop = name;
                prop.value = value;
                rule.insertAfter(decl, prop);
            });
            decl.remove();
        });
    },
    merge: function merge(rule) {
        var decls = rule.nodes.filter(function (node) {
            return node.prop && ~wc.indexOf(node.prop);
        });

        var _loop = function () {
            var lastNode = decls[decls.length - 1];
            var props = decls.filter(function (node) {
                return node.important === lastNode.important;
            });
            var values = wc.map(function (prop) {
                return (0, _getLastNode2['default'])(props, prop).value;
            });
            if (values.length > 1 && values[0] === values[1]) {
                values.pop();
            }
            var shorthand = (0, _clone2['default'])(lastNode);
            shorthand.prop = 'columns';
            shorthand.value = values.join(' ');
            rule.insertAfter(lastNode, shorthand);
            props.forEach(function (prop) {
                return prop.remove();
            });
            decls = decls.filter(function (node) {
                return ! ~props.indexOf(node);
            });
        };

        while (decls.length) {
            _loop();
        }
    }
};
module.exports = exports['default'];