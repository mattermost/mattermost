'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = doParallel;

var _eachOf = require('../eachOf');

var _eachOf2 = _interopRequireDefault(_eachOf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function doParallel(fn) {
    return function (obj, iteratee, callback) {
        return fn(_eachOf2.default, obj, iteratee, callback);
    };
}
module.exports = exports['default'];