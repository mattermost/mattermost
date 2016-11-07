'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = reduceRight;

var _reduce = require('./reduce');

var _reduce2 = _interopRequireDefault(_reduce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var slice = Array.prototype.slice;

/**
 * Same as `reduce`, only operates on `coll` in reverse order.
 *
 * @name reduceRight
 * @static
 * @memberOf async
 * @see async.reduce
 * @alias foldr
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
 */
function reduceRight(arr, memo, iteratee, cb) {
  var reversed = slice.call(arr).reverse();
  (0, _reduce2.default)(reversed, memo, iteratee, cb);
}
module.exports = exports['default'];