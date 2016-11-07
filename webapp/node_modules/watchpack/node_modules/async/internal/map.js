'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = _asyncMap;

var _isArrayLike = require('lodash/isArrayLike');

var _isArrayLike2 = _interopRequireDefault(_isArrayLike);

var _getIterator = require('./getIterator');

var _getIterator2 = _interopRequireDefault(_getIterator);

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

var _once = require('./once');

var _once2 = _interopRequireDefault(_once);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncMap(eachfn, arr, iteratee, callback) {
    callback = (0, _once2.default)(callback || _noop2.default);
    arr = arr || [];
    var results = (0, _isArrayLike2.default)(arr) || (0, _getIterator2.default)(arr) ? [] : {};
    eachfn(arr, function (value, index, callback) {
        iteratee(value, function (err, v) {
            results[index] = v;
            callback(err);
        });
    }, function (err) {
        callback(err, results);
    });
}
module.exports = exports['default'];