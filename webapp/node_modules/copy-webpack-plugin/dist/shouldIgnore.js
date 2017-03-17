'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _minimatch = require('minimatch');

var _minimatch2 = _interopRequireDefault(_minimatch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (pathName, ignoreList) {
    var matched = _lodash2.default.find(ignoreList, function (gb) {
        var glob = void 0,
            params = void 0;

        // Default minimatch params
        params = {
            matchBase: true
        };

        if (_lodash2.default.isString(gb)) {
            glob = gb;
        } else if (_lodash2.default.isObject(gb)) {
            glob = gb.glob || '';
            // Overwrite minimatch defaults
            params = _lodash2.default.assign(params, _lodash2.default.omit(gb, ['glob']));
        } else {
            glob = '';
        }

        return (0, _minimatch2.default)(pathName, glob, params);
    });

    return Boolean(matched);
};