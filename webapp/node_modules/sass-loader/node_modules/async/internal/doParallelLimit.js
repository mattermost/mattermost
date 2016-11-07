'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = doParallelLimit;

var _eachOfLimit = require('./eachOfLimit');

var _eachOfLimit2 = _interopRequireDefault(_eachOfLimit);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function doParallelLimit(fn) {
    return function (obj, limit, iteratee, callback) {
        return fn((0, _eachOfLimit2.default)(limit), obj, iteratee, callback);
    };
}
module.exports = exports['default'];