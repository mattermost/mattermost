'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _libCanMerge = require('./lib/canMerge');

var _libCanMerge2 = _interopRequireDefault(_libCanMerge);

var _libGetLastNode = require('./lib/getLastNode');

var _libGetLastNode2 = _interopRequireDefault(_libGetLastNode);

var _libHasAllProps = require('./lib/hasAllProps');

var _libHasAllProps2 = _interopRequireDefault(_libHasAllProps);

var _libIdentical = require('./lib/identical');

var _libIdentical2 = _interopRequireDefault(_libIdentical);

var _libMergeValues = require('./lib/mergeValues');

var _libMergeValues2 = _interopRequireDefault(_libMergeValues);

var _libMinifyTrbl = require('./lib/minifyTrbl');

var _libMinifyTrbl2 = _interopRequireDefault(_libMinifyTrbl);

var _libNumValues = require('./lib/numValues');

var _libNumValues2 = _interopRequireDefault(_libNumValues);

var trbl = ['top', 'right', 'bottom', 'left'];
var trblProps = ['margin', 'padding', 'border-color', 'border-width', 'border-style'];

var trblMap = function trblMap(prop) {
    return trbl.map(function (direction) {
        return prop + '-' + direction;
    });
};

var remove = function remove(node) {
    return node.remove();
};

var mergeLonghand = function mergeLonghand(rule, prop) {
    var properties = trblMap(prop);
    if (_libHasAllProps2['default'].apply(undefined, [rule].concat(properties))) {
        var rules = properties.map(function (p) {
            return (0, _libGetLastNode2['default'])(rule, p);
        });
        if (_libCanMerge2['default'].apply(undefined, rules)) {
            rules.slice(0, 3).forEach(remove);
            rules[3].value = (0, _libMinifyTrbl2['default'])(_libMergeValues2['default'].apply(undefined, rules));
            rules[3].prop = prop;
        }
    }
};

exports['default'] = _postcss2['default'].plugin('postcss-merge-longhand', function () {
    return function (css) {
        css.walkRules(function (rule) {
            rule.nodes.filter(function (node) {
                return node.prop && ~trblProps.indexOf(node.prop);
            }).forEach(function (node) {
                node.value = (0, _libMinifyTrbl2['default'])(node.value);
            });
            mergeLonghand(rule, 'margin');
            mergeLonghand(rule, 'padding');
            if ((0, _libHasAllProps2['default'])(rule, 'border-color', 'border-style', 'border-width')) {
                var rules = [(0, _libGetLastNode2['default'])(rule, 'border-width'), (0, _libGetLastNode2['default'])(rule, 'border-style'), (0, _libGetLastNode2['default'])(rule, 'border-color')];

                if (_libCanMerge2['default'].apply(undefined, rules) && _libNumValues2['default'].apply(undefined, rules) === 3) {
                    rules.slice(0, 2).forEach(remove);
                    rules[2].prop = 'border';
                    rules[2].value = _libMergeValues2['default'].apply(undefined, rules);
                }
            }
            if (_libHasAllProps2['default'].apply(undefined, [rule].concat(trblMap('border')))) {
                var rules = [(0, _libGetLastNode2['default'])(rule, 'border-top'), (0, _libGetLastNode2['default'])(rule, 'border-right'), (0, _libGetLastNode2['default'])(rule, 'border-bottom'), (0, _libGetLastNode2['default'])(rule, 'border-left')];

                if (_libCanMerge2['default'].apply(undefined, rules) && _libIdentical2['default'].apply(undefined, rules)) {
                    rules.slice(0, 3).forEach(remove);
                    rules[3].prop = 'border';
                }
            }
        });
    };
});
module.exports = exports['default'];