'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = timeLimit;

var _mapLimit = require('./mapLimit');

var _mapLimit2 = _interopRequireDefault(_mapLimit);

var _baseRange = require('lodash/_baseRange');

var _baseRange2 = _interopRequireDefault(_baseRange);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
* The same as {@link times} but runs a maximum of `limit` async operations at a
* time.
 *
 * @name timesLimit
 * @static
 * @memberOf async
 * @see async.times
 * @category Control Flow
 * @param {number} n - The number of times to run the function.
 * @param {number} limit - The maximum number of async operations at a time.
 * @param {Function} iteratee - The function to call `n` times. Invoked with the
 * iteration index and a callback (n, next).
 * @param {Function} callback - see {@link async.map}.
 */
function timeLimit(count, limit, iteratee, cb) {
  return (0, _mapLimit2.default)((0, _baseRange2.default)(0, count, 1), limit, iteratee, cb);
}
module.exports = exports['default'];