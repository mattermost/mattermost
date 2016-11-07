'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _postcss = require('postcss');

var _clone = require('../clone');

var _clone2 = _interopRequireDefault(_clone);

var _hasAllProps = require('../hasAllProps');

var _hasAllProps2 = _interopRequireDefault(_hasAllProps);

var _getLastNode = require('../getLastNode');

var _getLastNode2 = _interopRequireDefault(_getLastNode);

var _canMerge = require('../canMerge');

var _canMerge2 = _interopRequireDefault(_canMerge);

exports['default'] = function (direction) {
    var wsc = ['width', 'style', 'color'].map(function (d) {
        return 'border-' + direction + '-' + d;
    });
    var defaults = ['medium', 'none', 'currentColor'];
    var declaration = 'border-' + direction;
    var processor = {
        explode: function explode(rule) {
            rule.walkDecls(declaration, function (decl) {
                var values = _postcss.list.space(decl.value);
                wsc.forEach(function (prop, index) {
                    var node = (0, _clone2['default'])(decl);
                    node.prop = prop;
                    node.value = values[index];
                    if (node.value === undefined) {
                        node.value = defaults[index];
                    }
                    rule.insertAfter(decl, node);
                });
                decl.remove();
            });
        },
        merge: function merge(rule) {
            var decls = rule.nodes.filter(function (node) {
                return node.prop && ~wsc.indexOf(node.prop);
            });

            var _loop = function () {
                var lastNode = decls[decls.length - 1];
                var props = decls.filter(function (node) {
                    return node.important === lastNode.important;
                });
                if (_hasAllProps2['default'].apply(undefined, [props].concat(wsc)) && _canMerge2['default'].apply(undefined, props)) {
                    var values = wsc.map(function (prop) {
                        return (0, _getLastNode2['default'])(props, prop).value;
                    });
                    var value = values.concat(['']).reduceRight(function (prev, cur, i) {
                        if (prev === '' && cur === defaults[i]) {
                            return prev;
                        }
                        return cur + " " + prev;
                    }).trim();
                    if (value === '') {
                        value = defaults[0];
                    }
                    var shorthand = (0, _clone2['default'])(lastNode);
                    shorthand.prop = declaration;
                    shorthand.value = value;
                    rule.insertAfter(lastNode, shorthand);
                    props.forEach(function (prop) {
                        return prop.remove();
                    });
                }
                decls = decls.filter(function (node) {
                    return ! ~props.indexOf(node);
                });
            };

            while (decls.length) {
                _loop();
            }
        }
    };

    return processor;
};

module.exports = exports['default'];