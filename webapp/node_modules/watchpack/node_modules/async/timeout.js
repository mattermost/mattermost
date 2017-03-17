'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = timeout;

var _initialParams = require('./internal/initialParams');

var _initialParams2 = _interopRequireDefault(_initialParams);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Sets a time limit on an asynchronous function. If the function does not call
 * its callback within the specified miliseconds, it will be called with a
 * timeout error. The code property for the error object will be `'ETIMEDOUT'`.
 *
 * @name timeout
 * @static
 * @memberOf async
 * @category Util
 * @param {Function} function - The asynchronous function you want to set the
 * time limit.
 * @param {number} miliseconds - The specified time limit.
 * @param {*} [info] - Any variable you want attached (`string`, `object`, etc)
 * to timeout Error for more information..
 * @returns {Function} Returns a wrapped function that can be used with any of
 * the control flow functions.
 * @example
 *
 * async.timeout(function(callback) {
 *     doAsyncTask(callback);
 * }, 1000);
 */
function timeout(asyncFn, miliseconds, info) {
    var originalCallback, timer;
    var timedOut = false;

    function injectedCallback() {
        if (!timedOut) {
            originalCallback.apply(null, arguments);
            clearTimeout(timer);
        }
    }

    function timeoutCallback() {
        var name = asyncFn.name || 'anonymous';
        var error = new Error('Callback function "' + name + '" timed out.');
        error.code = 'ETIMEDOUT';
        if (info) {
            error.info = info;
        }
        timedOut = true;
        originalCallback(error);
    }

    return (0, _initialParams2.default)(function (args, origCallback) {
        originalCallback = origCallback;
        // setup timer and call original function
        timer = setTimeout(timeoutCallback, miliseconds);
        asyncFn.apply(null, args.concat(injectedCallback));
    });
}
module.exports = exports['default'];