'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (fn) {
    return (0, _baseRest2.default)(function (args /*..., callback*/) {
        var callback = args.pop();
        fn.call(this, args, callback);
    });
};

var _baseRest = require('lodash/_baseRest');

var _baseRest2 = _interopRequireDefault(_baseRest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];