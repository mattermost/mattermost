'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = seq;

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

var _reduce = require('./reduce');

var _reduce2 = _interopRequireDefault(_reduce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Version of the compose function that is more natural to read. Each function
 * consumes the return value of the previous function. It is the equivalent of
 * {@link async.compose} with the arguments reversed.
 *
 * Each function is executed with the `this` binding of the composed function.
 *
 * @name seq
 * @static
 * @memberOf async
 * @see async.compose
 * @category Control Flow
 * @param {...Function} functions - the asynchronous functions to compose
 * @example
 *
 * // Requires lodash (or underscore), express3 and dresende's orm2.
 * // Part of an app, that fetches cats of the logged user.
 * // This example uses `seq` function to avoid overnesting and error
 * // handling clutter.
 * app.get('/cats', function(request, response) {
 *     var User = request.models.User;
 *     async.seq(
 *         _.bind(User.get, User),  // 'User.get' has signature (id, callback(err, data))
 *         function(user, fn) {
 *             user.getCats(fn);      // 'getCats' has signature (callback(err, data))
 *         }
 *     )(req.session.user_id, function (err, cats) {
 *         if (err) {
 *             console.error(err);
 *             response.json({ status: 'error', message: err.message });
 *         } else {
 *             response.json({ status: 'ok', message: 'Cats found', data: cats });
 *         }
 *     });
 * });
 */
function seq() /* functions... */{
    var fns = arguments;
    return (0, _rest2.default)(function (args) {
        var that = this;

        var cb = args[args.length - 1];
        if (typeof cb == 'function') {
            args.pop();
        } else {
            cb = _noop2.default;
        }

        (0, _reduce2.default)(fns, args, function (newargs, fn, cb) {
            fn.apply(that, newargs.concat([(0, _rest2.default)(function (err, nextargs) {
                cb(err, nextargs);
            })]));
        }, function (err, results) {
            cb.apply(that, [err].concat(results));
        });
    });
}
module.exports = exports['default'];