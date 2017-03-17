'use strict';

/**
 * Undoes a {@link async.memoize}d function, reverting it to the original,
 * unmemoized form. Handy for testing.
 *
 * @name unmemoize
 * @static
 * @memberOf async
 * @see async.memoize
 * @category Util
 * @param {Function} fn - the memoized function
 */

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = unmemoize;
function unmemoize(fn) {
    return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
    };
}
module.exports = exports['default'];