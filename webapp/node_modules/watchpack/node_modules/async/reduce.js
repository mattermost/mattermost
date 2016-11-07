'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = reduce;

var _eachOfSeries = require('./eachOfSeries');

var _eachOfSeries2 = _interopRequireDefault(_eachOfSeries);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Reduces `coll` into a single value using an async `iteratee` to return each
 * successive step. `memo` is the initial state of the reduction. This function
 * only operates in series.
 *
 * For performance reasons, it may make sense to split a call to this function
 * into a parallel map, and then use the normal `Array.prototype.reduce` on the
 * results. This function is for situations where each step in the reduction
 * needs to be async; if you can get the data before reducing it, then it's
 * probably a good idea to do so.
 *
 * @name reduce
 * @static
 * @memberOf async
 * @alias inject, foldl
 * @category Collection
 * @param {Array|Object} coll - A collection to iterate over.
 * @param {*} memo - The initial state of the reduction.
 * @param {Function} iteratee - A function applied to each item in the
 * array to produce the next step in the reduction. The `iteratee` is passed a
 * `callback(err, reduction)` which accepts an optional error as its first
 * argument, and the state of the reduction as the second. If an error is
 * passed to the callback, the reduction is stopped and the main `callback` is
 * immediately called with the error. Invoked with (memo, item, callback).
 * @param {Function} [callback] - A callback which is called after all the
 * `iteratee` functions have finished. Result is the reduced value. Invoked with
 * (err, result).
 * @example
 *
 * async.reduce([1,2,3], 0, function(memo, item, callback) {
 *     // pointless async:
 *     process.nextTick(function() {
 *         callback(null, memo + item)
 *     });
 * }, function(err, result) {
 *     // result is now equal to the last value of memo, which is 6
 * });
 */
function reduce(arr, memo, iteratee, cb) {
    (0, _eachOfSeries2.default)(arr, function (x, i, cb) {
        iteratee(memo, x, function (err, v) {
            memo = v;
            cb(err);
        });
    }, function (err) {
        cb(err, memo);
    });
}
module.exports = exports['default'];