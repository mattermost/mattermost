'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = whilst;

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Repeatedly call `fn`, while `test` returns `true`. Calls `callback` when
 * stopped, or an error occurs.
 *
 * @name whilst
 * @static
 * @memberOf async
 * @category Control Flow
 * @param {Function} test - synchronous truth test to perform before each
 * execution of `fn`. Invoked with ().
 * @param {Function} fn - A function which is called each time `test` passes.
 * The function is passed a `callback(err)`, which must be called once it has
 * completed with an optional `err` argument. Invoked with (callback).
 * @param {Function} [callback] - A callback which is called after the test
 * function has failed and repeated execution of `fn` has stopped. `callback`
 * will be passed an error and any arguments passed to the final `fn`'s
 * callback. Invoked with (err, [results]);
 * @example
 *
 * var count = 0;
 * async.whilst(
 *     function() { return count < 5; },
 *     function(callback) {
 *         count++;
 *         setTimeout(function() {
 *             callback(null, count);
 *         }, 1000);
 *     },
 *     function (err, n) {
 *         // 5 seconds have passed, n = 5
 *     }
 * );
 */
function whilst(test, iteratee, cb) {
    cb = cb || _noop2.default;
    if (!test()) return cb(null);
    var next = (0, _rest2.default)(function (err, args) {
        if (err) return cb(err);
        if (test.apply(this, args)) return iteratee(next);
        cb.apply(null, [null].concat(args));
    });
    iteratee(next);
}
module.exports = exports['default'];