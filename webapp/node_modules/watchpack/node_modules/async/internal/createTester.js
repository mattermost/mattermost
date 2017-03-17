'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = _createTester;

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _createTester(eachfn, check, getResult) {
    return function (arr, limit, iteratee, cb) {
        function done(err) {
            if (cb) {
                if (err) {
                    cb(err);
                } else {
                    cb(null, getResult(false));
                }
            }
        }
        function wrappedIteratee(x, _, callback) {
            if (!cb) return callback();
            iteratee(x, function (err, v) {
                if (cb) {
                    if (err) {
                        cb(err);
                        cb = iteratee = false;
                    } else if (check(v)) {
                        cb(null, getResult(true, x));
                        cb = iteratee = false;
                    }
                }
                callback();
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