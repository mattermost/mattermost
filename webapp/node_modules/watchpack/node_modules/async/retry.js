'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = retry;

var _series = require('./series');

var _series2 = _interopRequireDefault(_series);

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Attempts to get a successful response from `task` no more than `times` times
 * before returning an error. If the task is successful, the `callback` will be
 * passed the result of the successful task. If all attempts fail, the callback
 * will be passed the error and result (if any) of the final attempt.
 *
 * @name retry
 * @static
 * @memberOf async
 * @category Control Flow
 * @param {Object|number} [opts = {times: 5, interval: 0}| 5] - Can be either an
 * object with `times` and `interval` or a number.
 * * `times` - The number of attempts to make before giving up.  The default
 *   is `5`.
 * * `interval` - The time to wait between retries, in milliseconds.  The
 *   default is `0`.
 * * If `opts` is a number, the number specifies the number of times to retry,
 *   with the default interval of `0`.
 * @param {Function} task - A function which receives two arguments: (1) a
 * `callback(err, result)` which must be called when finished, passing `err`
 * (which can be `null`) and the `result` of the function's execution, and (2)
 * a `results` object, containing the results of the previously executed
 * functions (if nested inside another control flow). Invoked with
 * (callback, results).
 * @param {Function} [callback] - An optional callback which is called when the
 * task has succeeded, or after the final failed attempt. It receives the `err`
 * and `result` arguments of the last attempt at completing the `task`. Invoked
 * with (err, results).
 * @example
 *
 * // The `retry` function can be used as a stand-alone control flow by passing
 * // a callback, as shown below:
 *
 * // try calling apiMethod 3 times
 * async.retry(3, apiMethod, function(err, result) {
 *     // do something with the result
 * });
 *
 * // try calling apiMethod 3 times, waiting 200 ms between each retry
 * async.retry({times: 3, interval: 200}, apiMethod, function(err, result) {
 *     // do something with the result
 * });
 *
 *  // try calling apiMethod the default 5 times no delay between each retry
 * async.retry(apiMethod, function(err, result) {
 *     // do something with the result
 * });
 *
 * // It can also be embedded within other control flow functions to retry
 * // individual methods that are not as reliable, like this:
 * async.auto({
 *     users: api.getUsers.bind(api),
 *     payments: async.retry(3, api.getPayments.bind(api))
 * }, function(err, results) {
 *     // do something with the results
 * });
 */
function retry(times, task, callback) {
    var DEFAULT_TIMES = 5;
    var DEFAULT_INTERVAL = 0;

    var opts = {
        times: DEFAULT_TIMES,
        interval: DEFAULT_INTERVAL
    };

    function parseTimes(acc, t) {
        if (typeof t === 'object') {
            acc.times = +t.times || DEFAULT_TIMES;
            acc.interval = +t.interval || DEFAULT_INTERVAL;
        } else if (typeof t === 'number' || typeof t === 'string') {
            acc.times = +t || DEFAULT_TIMES;
        } else {
            throw new Error("Invalid arguments for async.retry");
        }
    }

    if (arguments.length < 3 && typeof times === 'function') {
        callback = task || _noop2.default;
        task = times;
    } else {
        parseTimes(opts, times);
        callback = callback || _noop2.default;
    }

    if (typeof task !== 'function') {
        throw new Error("Invalid arguments for async.retry");
    }

    var attempts = [];
    while (opts.times) {
        var isFinalAttempt = !(opts.times -= 1);
        attempts.push(retryAttempt(isFinalAttempt));
        if (!isFinalAttempt && opts.interval > 0) {
            attempts.push(retryInterval(opts.interval));
        }
    }

    (0, _series2.default)(attempts, function (done, data) {
        data = data[data.length - 1];
        callback(data.err, data.result);
    });

    function retryAttempt(isFinalAttempt) {
        return function (seriesCallback) {
            task(function (err, result) {
                seriesCallback(!err || isFinalAttempt, {
                    err: err,
                    result: result
                });
            });
        };
    }

    function retryInterval(interval) {
        return function (seriesCallback) {
            setTimeout(function () {
                seriesCallback(null);
            }, interval);
        };
    }
}
module.exports = exports['default'];