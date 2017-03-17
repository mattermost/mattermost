'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = reflectAll;

var _reflect = require('./reflect');

var _reflect2 = _interopRequireDefault(_reflect);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * A helper function that wraps an array of functions with reflect.
 *
 * @name reflectAll
 * @static
 * @memberOf async
 * @see async.reflect
 * @category Util
 * @param {Array} tasks - The array of functions to wrap in `async.reflect`.
 * @returns {Array} Returns an array of functions, each function wrapped in
 * `async.reflect`
 * @example
 *
 * let tasks = [
 *     function(callback) {
 *         setTimeout(function() {
 *             callback(null, 'one');
 *         }, 200);
 *     },
 *     function(callback) {
 *         // do some more stuff but error ...
 *         callback(new Error('bad stuff happened'));
 *     },
 *     function(callback) {
 *         setTimeout(function() {
 *             callback(null, 'two');
 *         }, 100);
 *     }
 * ];
 *
 * async.parallel(async.reflectAll(tasks),
 * // optional callback
 * function(err, results) {
 *     // values
 *     // results[0].value = 'one'
 *     // results[1].error = Error('bad stuff happened')
 *     // results[2].value = 'two'
 * });
 */
function reflectAll(tasks) {
  return tasks.map(_reflect2.default);
}
module.exports = exports['default'];