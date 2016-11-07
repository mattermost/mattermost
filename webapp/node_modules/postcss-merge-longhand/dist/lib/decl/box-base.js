'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _hasAllProps = require('../hasAllProps');

var _hasAllProps2 = _interopRequireDefault(_hasAllProps);

var _canMerge = require('../canMerge');

var _canMerge2 = _interopRequireDefault(_canMerge);

var _minifyTrbl = require('../minifyTrbl');

var _minifyTrbl2 = _interopRequireDefault(_minifyTrbl);

var _parseTrbl = require('../parseTrbl');

var _parseTrbl2 = _interopRequireDefault(_parseTrbl);

var _getLastNode = require('../getLastNode');

var _getLastNode2 = _interopRequireDefault(_getLastNode);

var _mergeValues = require('../mergeValues');

var _mergeValues2 = _interopRequireDefault(_mergeValues);

var _type = require('../type');

var _type2 = _interopRequireDefault(_type);

var _clone = require('../clone');

var _clone2 = _interopRequireDefault(_clone);

var trbl = ['top', 'right', 'bottom', 'left'];

exports['default'] = function (property) {
    var processor = {
        explode: function explode(rule) {
            rule.walkDecls(property, function (decl) {
                var values = (0, _parseTrbl2['default'])(decl.value);
                trbl.forEach(function (direction, index) {
                    var prop = (0, _clone2['default'])(decl);
                    prop.prop = property + '-' + direction;
                    prop.value = values[index];
                    decl.parent.insertAfter(decl, prop);
                });
                decl.remove();
            });
        },
        merge: function merge(rule) {
            var properties = trbl.map(function (direction) {
                return property + '-' + direction;
            });
            var decls = rule.nodes.filter(function (node) {
                return node.prop && ~properties.indexOf(node.prop);
            });

            var _loop = function () {
                var lastNode = decls[decls.length - 1];
                var type = (0, _type2['default'])(lastNode);
                var props = decls.filter(function (node) {
                    return (0, _type2['default'])(node) === type && node.important === lastNode.important;
                });
                if (_hasAllProps2['default'].apply(undefined, [props].concat(properties))) {
                    var rules = properties.map(function (prop) {
                        return (0, _getLastNode2['default'])(props, prop);
                    });
                    var shorthand = (0, _clone2['default'])(lastNode);
                    shorthand.prop = property;
                    shorthand.value = (0, _minifyTrbl2['default'])(_mergeValues2['default'].apply(undefined, rules));
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

            if (_hasAllProps2['default'].apply(undefined, [rule].concat(properties))) {
                var rules = properties.map(function (p) {
                    return (0, _getLastNode2['default'])(rule.nodes, p);
                });
                if (_canMerge2['default'].apply(undefined, rules)) {
                    rules.slice(0, 3).forEach(function (rule) {
                        return rule.remove();
                    });
                    rules[3].value = (0, _minifyTrbl2['default'])(_mergeValues2['default'].apply(undefined, rules));
                    rules[3].prop = property;
                }
            }
        }
    };

    return processor;
};

module.exports = exports['default'];