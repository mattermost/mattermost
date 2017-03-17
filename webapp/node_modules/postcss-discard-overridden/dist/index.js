'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var OVERRIDABLE_RULES = ['keyframes', 'counter-style'];
var SCOPE_RULES = ['media', 'supports'];

function isOverridable(name) {
    return OVERRIDABLE_RULES.indexOf(_postcss2.default.vendor.unprefixed(name)) !== -1;
}

function isScope(name) {
    return SCOPE_RULES.indexOf(_postcss2.default.vendor.unprefixed(name)) !== -1;
}

function getScope(node) {
    var current = node.parent;
    var chain = [node.name, node.params];
    do {
        if (current.type === 'atrule' && isScope(current.name)) {
            chain.unshift(current.name + ' ' + current.params);
        }
        current = current.parent;
    } while (current);
    return chain.join('|');
}

exports.default = _postcss2.default.plugin('postcss-discard-overridden', function () {
    return function (css) {
        var cache = {};
        var rules = [];
        css.walkAtRules(function (rule) {
            if (rule.type === 'atrule' && isOverridable(rule.name)) {
                var scope = getScope(rule);
                cache[scope] = rule;
                rules.push({
                    node: rule,
                    scope: scope
                });
            }
        });
        rules.forEach(function (rule) {
            if (cache[rule.scope] !== rule.node) {
                rule.node.remove();
            }
        });
    };
});
module.exports = exports['default'];