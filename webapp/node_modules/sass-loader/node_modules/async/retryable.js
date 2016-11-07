'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (opts, task) {
    if (!task) {
        task = opts;
        opts = null;
    }
    return (0, _initialParams2.default)(function (args, callback) {
        function taskFn(cb) {
            task.apply(null, args.concat([cb]));
        }

        if (opts) (0, _retry2.default)(opts, taskFn, callback);else (0, _retry2.default)(taskFn, callback);
    });
};

var _retry = require('./retry');

var _retry2 = _interopRequireDefault(_retry);

var _initialParams = require('./internal/initialParams');

var _initialParams2 = _interopRequireDefault(_initialParams);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];

/**
 * A close relative of [`retry`]{@link module:ControlFlow.retry}.  This method wraps a task and makes it
 * retryable, rather than immediately calling it with retries.
 *
 * @name retryable
 * @static
 * @memberOf module:ControlFlow
 * @method
 * @see [async.retry]{@link module:ControlFlow.retry}
 * @category Control Flow
 * @param {Object|number} [opts = {times: 5, interval: 0}| 5] - optional
 * options, exactly the same as from `retry`
 * @param {Function} task - the asynchronous function to wrap
 * @returns {Functions} The wrapped function, which when invoked, will retry on
 * an error, based on the parameters specified in `opts`.
 * @example
 *
 * async.auto({
 *     dep1: async.retryable(3, getFromFlakyService),
 *     process: ["dep1", async.retryable(3, function (results, cb) {
 *         maybeProcessData(results.dep1, cb);
 *     })]
 * }, callback);
 */