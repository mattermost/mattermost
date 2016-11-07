'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = race;

var _isArray = require('lodash/isArray');

var _isArray2 = _interopRequireDefault(_isArray);

var _each = require('lodash/each');

var _each2 = _interopRequireDefault(_each);

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

var _once = require('./internal/once');

var _once2 = _interopRequireDefault(_once);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Runs the `tasks` array of functions in parallel, without waiting until the
 * previous function has completed. Once any the `tasks` completed or pass an
 * error to its callback, the main `callback` is immediately called. It's
 * equivalent to `Promise.race()`.
 *
 * @name race
 * @static
 * @memberOf async
 * @category Control Flow
 * @param {Array} tasks - An array containing functions to run. Each function
 * is passed a `callback(err, result)` which it must call on completion with an
 * error `err` (which can be `null`) and an optional `result` value.
 * @param {Function} callback - A callback to run once any of the functions have
 * completed. This function gets an error or result from the first function that
 * completed. Invoked with (err, result).
 * @example
 *
 * async.race([
 *     function(callback) {
 *         setTimeout(function() {
 *             callback(null, 'one');
 *         }, 200);
 *     },
 *     function(callback) {
 *         setTimeout(function() {
 *             callback(null, 'two');
 *         }, 100);
 *     }
 * ],
 * // main callback
 * function(err, result) {
 *     // the result will be equal to 'two' as it finishes earlier
 * });
 */
function race(tasks, cb) {
    cb = (0, _once2.default)(cb || _noop2.default);
    if (!(0, _isArray2.default)(tasks)) return cb(new TypeError('First argument to race must be an array of functions'));
    if (!tasks.length) return cb();
    (0, _each2.default)(tasks, function (task) {
        task(cb);
    });
}
module.exports = exports['default'];