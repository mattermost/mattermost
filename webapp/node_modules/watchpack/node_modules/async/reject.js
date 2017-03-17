'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _rejectLimit = require('./rejectLimit');

var _rejectLimit2 = _interopRequireDefault(_rejectLimit);

var _doLimit = require('./internal/doLimit');

var _doLimit2 = _interopRequireDefault(_doLimit);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The opposite of `filter`. Removes values that pass an `async` truth test.
 *
 * @name reject
 * @static
 * @memberOf async
 * @see async.filter
 * @category Collection
 * @param {Array|Object} coll - A collection to iterate over.
 * @param {Function} iteratee - A truth test to apply to each item in `coll`.
 * The `iteratee` is passed a `callback(err, truthValue)`, which must be called
 * with a boolean argument once it has completed. Invoked with (item, callback).
 * @param {Function} [callback] - A callback which is called after all the
 * `iteratee` functions have finished. Invoked with (err, results).
 * @example
 *
 * async.reject(['file1','file2','file3'], function(filePath, callback) {
 *     fs.access(filePath, function(err) {
 *         callback(null, !err)
 *     });
 * }, function(err, results) {
 *     // results now equals an array of missing files
 *     createFiles(results);
 * });
 */
exports.default = (0, _doLimit2.default)(_rejectLimit2.default, Infinity);
module.exports = exports['default'];