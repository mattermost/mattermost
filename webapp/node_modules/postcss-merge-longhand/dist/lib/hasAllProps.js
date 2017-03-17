'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

exports['default'] = function (rule) {
    for (var _len = arguments.length, props = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        props[_key - 1] = arguments[_key];
    }

    return props.every(function (p) {
        return rule.some(function (_ref) {
            var prop = _ref.prop;
            return prop && ~prop.indexOf(p);
        });
    });
};

module.exports = exports['default'];