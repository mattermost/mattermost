'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = _filter;

var _arrayMap = require('lodash/_arrayMap');

var _arrayMap2 = _interopRequireDefault(_arrayMap);

var _baseProperty = require('lodash/_baseProperty');

var _baseProperty2 = _interopRequireDefault(_baseProperty);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _filter(eachfn, arr, iteratee, callback) {
    var results = [];
    eachfn(arr, function (x, index, callback) {
        iteratee(x, function (err, v) {
            if (err) {
                callback(err);
            } else {
                if (v) {
                    results.push({ index: index, value: x });
                }
                callback();
            }
        });
    }, function (err) {
        if (err) {
            callback(err);
        } else {
            callback(null, (0, _arrayMap2.default)(results.sort(function (a, b) {
                return a.index - b.index;
            }), (0, _baseProperty2.default)('value')));
        }
    });
}
module.exports = exports['default'];