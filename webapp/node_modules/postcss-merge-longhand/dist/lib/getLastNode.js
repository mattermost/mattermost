'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

exports['default'] = function (rule, prop) {
    return rule.nodes.filter(function (n) {
        return n.prop && ~n.prop.indexOf(prop);
    }).pop();
};

module.exports = exports['default'];