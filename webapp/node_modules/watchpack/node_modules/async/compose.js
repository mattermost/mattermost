'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = compose;

var _seq = require('./seq');

var _seq2 = _interopRequireDefault(_seq);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var reverse = Array.prototype.reverse;

/**
 * Creates a function which is a composition of the passed asynchronous
 * functions. Each function consumes the return value of the function that
 * follows. Composing functions `f()`, `g()`, and `h()` would produce the result
 * of `f(g(h()))`, only this version uses callbacks to obtain the return values.
 *
 * Each function is executed with the `this` binding of the composed function.
 *
 * @name compose
 * @static
 * @memberOf async
 * @category Control Flow
 * @param {...Function} functions - the asynchronous functions to compose
 * @example
 *
 * function add1(n, callback) {
 *     setTimeout(function () {
 *         callback(null, n + 1);
 *     }, 10);
 * }
 *
 * function mul3(n, callback) {
 *     setTimeout(function () {
 *         callback(null, n * 3);
 *     }, 10);
 * }
 *
 * var add1mul3 = async.compose(mul3, add1);
 * add1mul3(4, function (err, result) {
 *     // result now equals 15
 * });
 */
function compose() /* functions... */{
  return _seq2.default.apply(null, reverse.call(arguments));
}
module.exports = exports['default'];