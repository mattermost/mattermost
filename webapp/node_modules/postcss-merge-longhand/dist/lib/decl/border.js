'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _postcss = require('postcss');

var _hasAllProps = require('../hasAllProps');

var _hasAllProps2 = _interopRequireDefault(_hasAllProps);

var _getLastNode = require('../getLastNode');

var _getLastNode2 = _interopRequireDefault(_getLastNode);

var _minifyTrbl = require('../minifyTrbl');

var _minifyTrbl2 = _interopRequireDefault(_minifyTrbl);

var _clone = require('../clone');

var _clone2 = _interopRequireDefault(_clone);

var _numValues = require('../numValues');

var _numValues2 = _interopRequireDefault(_numValues);

var _canMerge = require('../canMerge');

var _canMerge2 = _interopRequireDefault(_canMerge);

var wsc = ['border-width', 'border-style', 'border-color'];
var trbl = ['border-top', 'border-right', 'border-bottom', 'border-left'];
var defaults = ['medium', 'none', 'currentColor'];

exports['default'] = {
    explode: function explode(rule) {
        rule.walkDecls('border', function (decl) {
            trbl.forEach(function (prop) {
                var node = (0, _clone2['default'])(decl);
                node.prop = prop;
                rule.insertAfter(decl, node);
            });

            decl.remove();
        });
    },
    merge: function merge(rule) {
        var decls = rule.nodes.filter(function (node) {
            return node.prop && ~trbl.indexOf(node.prop);
        });

        var _loop = function () {
            var lastNode = decls[decls.length - 1];
            var props = decls.filter(function (node) {
                return node.important === lastNode.important;
            });
            if (_hasAllProps2['default'].apply(undefined, [props].concat(trbl))) {
                (function () {
                    var rules = trbl.map(function (prop) {
                        return (0, _getLastNode2['default'])(props, prop);
                    });
                    wsc.forEach(function (prop, index) {
                        var values = rules.map(function (node) {
                            var value = _postcss.list.space(node.value)[index];
                            if (value === undefined) {
                                value = defaults[index];
                            }
                            return value;
                        });
                        var decl = (0, _clone2['default'])(lastNode);
                        decl.prop = prop;
                        decl.value = values.join(' ');
                        rule.insertAfter(lastNode, decl);
                    });
                    props.forEach(function (prop) {
                        return prop.remove();
                    });
                })();
            }
            decls = decls.filter(function (node) {
                return ! ~props.indexOf(node);
            });
        };

        while (decls.length) {
            _loop();
        }

        decls = rule.nodes.filter(function (node) {
            return node.prop && ~wsc.indexOf(node.prop);
        });
        decls.forEach(function (node) {
            return node.value = (0, _minifyTrbl2['default'])(node.value);
        });
        decls = decls.filter(function (node) {
            return (0, _numValues2['default'])(node) === 1;
        });

        var _loop2 = function () {
            var lastNode = decls[decls.length - 1];
            var valueLength = (0, _numValues2['default'])(lastNode);
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
                shorthand.prop = 'border';
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
            _loop2();
        }
    }
};
module.exports = exports['default'];