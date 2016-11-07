'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

var _postcss = require('postcss');

var space = _postcss.list.space;

exports['default'] = function () {
    for (var _len = arguments.length, rules = Array(_len), _key = 0; _key < _len; _key++) {
        rules[_key] = arguments[_key];
    }

    return rules.reduce(function (memo, rule) {
        memo += space(rule.value).length;
        return memo;
    }, 0);
};

module.exports = exports['default'];