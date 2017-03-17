'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = iterator;

var _isArrayLike = require('lodash/isArrayLike');

var _isArrayLike2 = _interopRequireDefault(_isArrayLike);

var _getIterator = require('./getIterator');

var _getIterator2 = _interopRequireDefault(_getIterator);

var _keys = require('lodash/keys');

var _keys2 = _interopRequireDefault(_keys);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function iterator(coll) {
    var i = -1;
    var len;
    if ((0, _isArrayLike2.default)(coll)) {
        len = coll.length;
        return function next() {
            i++;
            return i < len ? { value: coll[i], key: i } : null;
        };
    }

    var iterate = (0, _getIterator2.default)(coll);
    if (iterate) {
        return function next() {
            var item = iterate.next();
            if (item.done) return null;
            i++;
            return { value: item.value, key: i };
        };
    }

    var okeys = (0, _keys2.default)(coll);
    len = okeys.length;
    return function next() {
        i++;
        var key = okeys[i];
        return i < len ? { value: coll[key], key: key } : null;
    };
}
module.exports = exports['default'];