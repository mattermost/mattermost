'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _concat = require('./internal/concat');

var _concat2 = _interopRequireDefault(_concat);

var _doSeries = require('./internal/doSeries');

var _doSeries2 = _interopRequireDefault(_doSeries);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The same as `concat` but runs only a single async operation at a time.
 *
 * @name concatSeries
 * @static
 * @memberOf async
 * @see async.concat
 * @category Collection
 * @param {Array|Object} coll - A collection to iterate over.
 * @param {Function} iteratee - A function to apply to each item in `coll`.
 * The iteratee is passed a `callback(err, results)` which must be called once
 * it has completed with an error (which can be `null`) and an array of results.
 * Invoked with (item, callback).
 * @param {Function} [callback(err)] - A callback which is called after all the
 * `iteratee` functions have finished, or an error occurs. Results is an array
 * containing the concatenated results of the `iteratee` function. Invoked with
 * (err, results).
 */
exports.default = (0, _doSeries2.default)(_concat2.default);
module.exports = exports['default'];