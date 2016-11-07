'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = _createTester;

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

var _breakLoop = require('./breakLoop');

var _breakLoop2 = _interopRequireDefault(_breakLoop);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _createTester(eachfn, check, getResult) {
    return function (arr, limit, iteratee, cb) {
        function done() {
            if (cb) {
                cb(null, getResult(false));
            }
        }
        function wrappedIteratee(x, _, callback) {
            if (!cb) return callback();
            iteratee(x, function (err, v) {
                // Check cb as another iteratee may have resolved with a
                // value or error since we started this iteratee
                if (cb && (err || check(v))) {
                    if (err) cb(err);else cb(err, getResult(true, x));
                    cb = iteratee = false;
                    callback(err, _breakLoop2.default);
                } else {
                    callback();
                }
            });
        }
        if (arguments.length > 3) {
            cb = cb || _noop2.default;
            eachfn(arr, limit, wrappedIteratee, done);
        } else {
            cb = iteratee;
            cb = cb || _noop2.default;
            iteratee = limit;
            eachfn(arr, wrappedIteratee, done);
        }
    };
}
module.exports = exports['default'];