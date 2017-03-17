'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _identity = require('lodash/identity');

var _identity2 = _interopRequireDefault(_identity);

var _createTester = require('./internal/createTester');

var _createTester2 = _interopRequireDefault(_createTester);

var _eachOfSeries = require('./eachOfSeries');

var _eachOfSeries2 = _interopRequireDefault(_eachOfSeries);

var _findGetResult = require('./internal/findGetResult');

var _findGetResult2 = _interopRequireDefault(_findGetResult);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The same as `detect` but runs only a single async operation at a time.
 *
 * @name detectSeries
 * @static
 * @memberOf async
 * @see async.detect
 * @alias findSeries
 * @category Collection
 * @param {Array|Object} coll - A collection to iterate over.
 * @param {Function} iteratee - A truth test to apply to each item in `coll`.
 * The iteratee is passed a `callback(err, truthValue)` which must be called
 * with a boolean argument once it has completed. Invoked with (item, callback).
 * @param {Function} [callback] - A callback which is called as soon as any
 * iteratee returns `true`, or after all the `iteratee` functions have finished.
 * Result will be the first item in the array that passes the truth test
 * (iteratee) or the value `undefined` if none passed. Invoked with
 * (err, result).
 */
exports.default = (0, _createTester2.default)(_eachOfSeries2.default, _identity2.default, _findGetResult2.default);
module.exports = exports['default'];