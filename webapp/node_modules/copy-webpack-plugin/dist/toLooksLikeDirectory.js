'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (pattern) {
    var filename = pattern.to || '';

    return pattern.toType !== 'file' && (_path2.default.extname(filename) === '' || _lodash2.default.last(filename) === _path2.default.sep || _lodash2.default.last(filename) === '/' || pattern.toType === 'dir');
};