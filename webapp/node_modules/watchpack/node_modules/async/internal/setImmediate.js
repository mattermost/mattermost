'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var _setImmediate = typeof setImmediate === 'function' && setImmediate;

var _defer;
if (_setImmediate) {
    _defer = _setImmediate;
} else if (typeof process === 'object' && typeof process.nextTick === 'function') {
    _defer = process.nextTick;
} else {
    _defer = function (fn) {
        setTimeout(fn, 0);
    };
}

exports.default = (0, _rest2.default)(function (fn, args) {
    _defer(function () {
        fn.apply(null, args);
    });
});
module.exports = exports['default'];