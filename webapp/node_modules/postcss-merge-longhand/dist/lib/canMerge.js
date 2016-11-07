'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});
var important = function important(node) {
    return node.important;
};
var unimportant = function unimportant(node) {
    return !node.important;
};
var hasInherit = function hasInherit(node) {
    return ~node.value.indexOf('inherit');
};

exports['default'] = function () {
    for (var _len = arguments.length, props = Array(_len), _key = 0; _key < _len; _key++) {
        props[_key] = arguments[_key];
    }

    if (props.some(hasInherit)) {
        return false;
    }
    return props.every(important) || props.every(unimportant);
};

module.exports = exports['default'];