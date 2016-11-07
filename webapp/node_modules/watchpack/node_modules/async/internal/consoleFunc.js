'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = consoleFunc;

var _arrayEach = require('lodash/_arrayEach');

var _arrayEach2 = _interopRequireDefault(_arrayEach);

var _rest = require('lodash/rest');

var _rest2 = _interopRequireDefault(_rest);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function consoleFunc(name) {
    return (0, _rest2.default)(function (fn, args) {
        fn.apply(null, args.concat([(0, _rest2.default)(function (err, args) {
            if (typeof console === 'object') {
                if (err) {
                    if (console.error) {
                        console.error(err);
                    }
                } else if (console[name]) {
                    (0, _arrayEach2.default)(args, function (x) {
                        console[name](x);
                    });
                }
            }
        })]));
    });
}
module.exports = exports['default'];