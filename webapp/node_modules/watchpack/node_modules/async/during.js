'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = during;

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Like {@link async.whilst}, except the `test` is an asynchronous function that
 * is passed a callback in the form of `function (err, truth)`. If error is
 * passed to `test` or `fn`, the main callback is immediately called with the
 * value of the error.
 *
 * @name during
 * @static
 * @memberOf async
 * @see async.whilst
 * @category Control Flow
 * @param {Function} test - asynchronous truth test to perform before each
 * execution of `fn`. Invoked with (callback).
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
 *
 * async.during(
 *     function (callback) {
 *         return callback(null, count < 5);
 *     },
 *     function (callback) {
 *         count++;
 *         setTimeout(callback, 1000);
 *     },
 *     function (err) {
 *         // 5 seconds have passed
 *     }
 * );
 */
function during(test, iteratee, cb) {
    cb = cb || _noop2.default;

    var next = (0, _rest2.default)(function (err, args) {
        if (err) {
            cb(err);
        } else {
            args.push(check);
            test.apply(this, args);
        }
    });

    var check = function (err, truth) {
        if (err) return cb(err);
        if (!truth) return cb(null);
        iteratee(next);
    };

    test(check);
}
module.exports = exports['default'];