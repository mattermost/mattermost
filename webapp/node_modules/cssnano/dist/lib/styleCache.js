'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

exports.default = (0, _postcss.plugin)('cssnano-reset-stylecache', function () {
    return function (css, result) {
        result.root.rawCache = {
            colon: ':',
            indent: '',
            beforeDecl: '',
            beforeRule: '',
            beforeOpen: '',
            beforeClose: '',
            beforeComment: '',
            after: '',
            emptyBody: '',
            commentLeft: '',
            commentRight: ''
        };
    };
});
module.exports = exports['default'];