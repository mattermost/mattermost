'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

exports['default'] = function () {
    for (var _len = arguments.length, rules = Array(_len), _key = 0; _key < _len; _key++) {
        rules[_key] = arguments[_key];
    }

    var candidate = rules[0].value;
    return rules.every(function (_ref) {
        var value = _ref.value;
        return value === candidate;
    });
};

module.exports = exports['default'];