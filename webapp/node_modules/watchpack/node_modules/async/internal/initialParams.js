'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (fn) {
    return (0, _rest2.default)(function (args /*..., callback*/) {
        var callback = args.pop();
        fn.call(this, args, callback);
    });
};

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];