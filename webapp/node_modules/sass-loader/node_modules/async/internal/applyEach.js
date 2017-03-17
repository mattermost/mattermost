'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = applyEach;

var _baseRest = require('lodash/_baseRest');

var _baseRest2 = _interopRequireDefault(_baseRest);

var _initialParams = require('./initialParams');

var _initialParams2 = _interopRequireDefault(_initialParams);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function applyEach(eachfn) {
    return (0, _baseRest2.default)(function (fns, args) {
        var go = (0, _initialParams2.default)(function (args, callback) {
            var that = this;
            return eachfn(fns, function (fn, cb) {
                fn.apply(that, args.concat([cb]));
            }, callback);
        });
        if (args.length) {
            return go.apply(this, args);
        } else {
            return go;
        }
    });
}
module.exports = exports['default'];