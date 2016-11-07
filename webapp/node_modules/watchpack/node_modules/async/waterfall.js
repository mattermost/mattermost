'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (tasks, cb) {
    cb = (0, _once2.default)(cb || _noop2.default);
    if (!(0, _isArray2.default)(tasks)) return cb(new Error('First argument to waterfall must be an array of functions'));
    if (!tasks.length) return cb();
    var taskIndex = 0;

    function nextTask(args) {
        if (taskIndex === tasks.length) {
            return cb.apply(null, [null].concat(args));
        }

        var taskCallback = (0, _onlyOnce2.default)((0, _rest2.default)(function (err, args) {
            if (err) {
                return cb.apply(null, [err].concat(args));
            }
            nextTask(args);
        }));

        args.push(taskCallback);

        var task = tasks[taskIndex++];
        task.apply(null, args);
    }

    nextTask([]);
};

var _isArray = require('lodash/isArray');

var _isArray2 = _interopRequireDefault(_isArray);

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

var _once = require('./internal/once');

var _once2 = _interopRequireDefault(_once);

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

var _onlyOnce = require('./internal/onlyOnce');

var _onlyOnce2 = _interopRequireDefault(_onlyOnce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports['default'];

/**
 * Runs the `tasks` array of functions in series, each passing their results to
 * the next in the array. However, if any of the `tasks` pass an error to their
 * own callback, the next function is not executed, and the main `callback` is
 * immediately called with the error.
 *
 * @name waterfall
 * @static
 * @memberOf async
 * @category Control Flow
 * @param {Array} tasks - An array of functions to run, each function is passed
 * a `callback(err, result1, result2, ...)` it must call on completion. The
 * first argument is an error (which can be `null`) and any further arguments
 * will be passed as arguments in order to the next task.
 * @param {Function} [callback] - An optional callback to run once all the
 * functions have completed. This will be passed the results of the last task's
 * callback. Invoked with (err, [results]).
 * @example
 *
 * async.waterfall([
 *     function(callback) {
 *         callback(null, 'one', 'two');
 *     },
 *     function(arg1, arg2, callback) {
 *         // arg1 now equals 'one' and arg2 now equals 'two'
 *         callback(null, 'three');
 *     },
 *     function(arg1, callback) {
 *         // arg1 now equals 'three'
 *         callback(null, 'done');
 *     }
 * ], function (err, result) {
 *     // result now equals 'done'
 * });
 *
 * // Or, with named functions:
 * async.waterfall([
 *     myFirstFunction,
 *     mySecondFunction,
 *     myLastFunction,
 * ], function (err, result) {
 *     // result now equals 'done'
 * });
 * function myFirstFunction(callback) {
 *     callback(null, 'one', 'two');
 * }
 * function mySecondFunction(arg1, arg2, callback) {
 *     // arg1 now equals 'one' and arg2 now equals 'two'
 *     callback(null, 'three');
 * }
 * function myLastFunction(arg1, callback) {
 *     // arg1 now equals 'three'
 *     callback(null, 'done');
 * }
 */