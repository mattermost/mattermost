'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = sortBy;

var _arrayMap = require('lodash/_arrayMap');

var _arrayMap2 = _interopRequireDefault(_arrayMap);

var _baseProperty = require('lodash/_baseProperty');

var _baseProperty2 = _interopRequireDefault(_baseProperty);

var _map = require('./map');

var _map2 = _interopRequireDefault(_map);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Sorts a list by the results of running each `coll` value through an async
 * `iteratee`.
 *
 * @name sortBy
 * @static
 * @memberOf async
 * @category Collection
 * @param {Array|Object} coll - A collection to iterate over.
 * @param {Function} iteratee - A function to apply to each item in `coll`.
 * The iteratee is passed a `callback(err, sortValue)` which must be called once
 * it has completed with an error (which can be `null`) and a value to use as
 * the sort criteria. Invoked with (item, callback).
 * @param {Function} [callback] - A callback which is called after all the
 * `iteratee` functions have finished, or an error occurs. Results is the items
 * from the original `coll` sorted by the values returned by the `iteratee`
 * calls. Invoked with (err, results).
 * @example
 *
 * async.sortBy(['file1','file2','file3'], function(file, callback) {
 *     fs.stat(file, function(err, stats) {
 *         callback(err, stats.mtime);
 *     });
 * }, function(err, results) {
 *     // results is now the original array of files sorted by
 *     // modified date
 * });
 *
 * // By modifying the callback parameter the
 * // sorting order can be influenced:
 *
 * // ascending order
 * async.sortBy([1,9,3,5], function(x, callback) {
 *     callback(null, x);
 * }, function(err,result) {
 *     // result callback
 * });
 *
 * // descending order
 * async.sortBy([1,9,3,5], function(x, callback) {
 *     callback(null, x*-1);    //<- x*-1 instead of x, turns the order around
 * }, function(err,result) {
 *     // result callback
 * });
 */
function sortBy(arr, iteratee, cb) {
    (0, _map2.default)(arr, function (x, cb) {
        iteratee(x, function (err, criteria) {
            if (err) return cb(err);
            cb(null, { value: x, criteria: criteria });
        });
    }, function (err, results) {
        if (err) return cb(err);
        cb(null, (0, _arrayMap2.default)(results.sort(comparator), (0, _baseProperty2.default)('value')));
    });

    function comparator(left, right) {
        var a = left.criteria,
            b = right.criteria;
        return a < b ? -1 : a > b ? 1 : 0;
    }
}
module.exports = exports['default'];