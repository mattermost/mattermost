'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = doUntil;

var _doWhilst = require('./doWhilst');

var _doWhilst2 = _interopRequireDefault(_doWhilst);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Like {@link async.doWhilst}, except the `test` is inverted. Note the
 * argument ordering differs from `until`.
 *
 * @name doUntil
 * @static
 * @memberOf async
 * @see async.doWhilst
 * @category Control Flow
 * @param {Function} fn - A function which is called each time `test` fails.
 * The function is passed a `callback(err)`, which must be called once it has
 * completed with an optional `err` argument. Invoked with (callback).
 * @param {Function} test - synchronous truth test to perform before each
 * execution of `fn`. Invoked with ().
 * @param {Function} [callback] - A callback which is called after the test
 * function has passed and repeated execution of `fn` has stopped. `callback`
 * will be passed an error and any arguments passed to the final `fn`'s
 * callback. Invoked with (err, [results]);
 */
function doUntil(iteratee, test, cb) {
    return (0, _doWhilst2.default)(iteratee, function () {
        return !test.apply(this, arguments);
    }, cb);
}
module.exports = exports['default'];