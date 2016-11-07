'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createTester = require('./internal/createTester');

var _createTester2 = _interopRequireDefault(_createTester);

var _eachOf = require('./eachOf');

var _eachOf2 = _interopRequireDefault(_eachOf);

var _identity = require('lodash/identity');

var _identity2 = _interopRequireDefault(_identity);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Returns `true` if at least one element in the `coll` satisfies an async test.
 * If any iteratee call returns `true`, the main `callback` is immediately
 * called.
 *
 * @name some
 * @static
 * @memberOf module:Collections
 * @method
 * @alias any
 * @category Collection
 * @param {Array|Iterable|Object} coll - A collection to iterate over.
 * @param {Function} iteratee - A truth test to apply to each item in the array
 * in parallel. The iteratee is passed a `callback(err, truthValue)` which must
 * be called with a boolean argument once it has completed. Invoked with
 * (item, callback).
 * @param {Function} [callback] - A callback which is called as soon as any
 * iteratee returns `true`, or after all the iteratee functions have finished.
 * Result will be either `true` or `false` depending on the values of the async
 * tests. Invoked with (err, result).
 * @example
 *
 * async.some(['file1','file2','file3'], function(filePath, callback) {
 *     fs.access(filePath, function(err) {
 *         callback(null, !err)
 *     });
 * }, function(err, result) {
 *     // if result is true then at least one of the files exists
 * });
 */
exports.default = (0, _createTester2.default)(_eachOf2.default, Boolean, _identity2.default);
module.exports = exports['default'];