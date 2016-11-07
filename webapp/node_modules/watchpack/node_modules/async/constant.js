'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

var _initialParams = require('./internal/initialParams');

var _initialParams2 = _interopRequireDefault(_initialParams);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Returns a function that when called, calls-back with the values provided.
 * Useful as the first function in a `waterfall`, or for plugging values in to
 * `auto`.
 *
 * @name constant
 * @static
 * @memberOf async
 * @category Util
 * @param {...*} arguments... - Any number of arguments to automatically invoke
 * callback with.
 * @returns {Function} Returns a function that when invoked, automatically
 * invokes the callback with the previous given arguments.
 * @example
 *
 * async.waterfall([
 *     async.constant(42),
 *     function (value, next) {
 *         // value === 42
 *     },
 *     //...
 * ], callback);
 *
 * async.waterfall([
 *     async.constant(filename, "utf8"),
 *     fs.readFile,
 *     function (fileData, next) {
 *         //...
 *     }
 *     //...
 * ], callback);
 *
 * async.auto({
 *     hostname: async.constant("https://server.net/"),
 *     port: findFreePort,
 *     launchServer: ["hostname", "port", function (options, cb) {
 *         startServer(options, cb);
 *     }],
 *     //...
 * }, callback);
 */
exports.default = (0, _rest2.default)(function (values) {
    var args = [null].concat(values);
    return (0, _initialParams2.default)(function (ignoredArgs, callback) {
        return callback.apply(this, args);
    });
});
module.exports = exports['default'];