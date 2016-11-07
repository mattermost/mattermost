'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Creates a continuation function with some arguments already applied.
 *
 * Useful as a shorthand when combined with other control flow functions. Any
 * arguments passed to the returned function are added to the arguments
 * originally passed to apply.
 *
 * @name apply
 * @static
 * @memberOf async
 * @category Util
 * @param {Function} function - The function you want to eventually apply all
 * arguments to. Invokes with (arguments...).
 * @param {...*} arguments... - Any number of arguments to automatically apply
 * when the continuation is called.
 * @example
 *
 * // using apply
 * async.parallel([
 *     async.apply(fs.writeFile, 'testfile1', 'test1'),
 *     async.apply(fs.writeFile, 'testfile2', 'test2')
 * ]);
 *
 *
 * // the same process without using apply
 * async.parallel([
 *     function(callback) {
 *         fs.writeFile('testfile1', 'test1', callback);
 *     },
 *     function(callback) {
 *         fs.writeFile('testfile2', 'test2', callback);
 *     }
 * ]);
 *
 * // It's possible to pass any number of additional arguments when calling the
 * // continuation:
 *
 * node> var fn = async.apply(sys.puts, 'one');
 * node> fn('two', 'three');
 * one
 * two
 * three
 */
exports.default = (0, _rest2.default)(function (fn, args) {
    return (0, _rest2.default)(function (callArgs) {
        return fn.apply(null, args.concat(callArgs));
    });
});
module.exports = exports['default'];