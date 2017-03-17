'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

var atrule = 'atrule';
var decl = 'decl';
var rule = 'rule';

function minimiseWhitespace(node) {
    var type = node.type;

    if (~[decl, rule, atrule].indexOf(type) && node.raws.before) {
        node.raws.before = node.raws.before.replace(/\s/g, '');
    }
    if (type === decl) {
        // Ensure that !important values do not have any excess whitespace
        if (node.important) {
            node.raws.important = '!important';
        }
        // Remove whitespaces around ie 9 hack
        node.value = node.value.replace(/\s*(\\9)\s*/, '$1');
        // Remove extra semicolons and whitespace before the declaration
        if (node.raws.before) {
            var prev = node.prev();
            if (prev && prev.type !== rule) {
                node.raws.before = node.raws.before.replace(/;/g, '');
            }
        }
        node.raws.between = ':';
        node.raws.semicolon = false;
    } else if (type === rule || type === atrule) {
        node.raws.between = node.raws.after = '';
        node.raws.semicolon = false;
    }
}

exports.default = (0, _postcss.plugin)('cssnano-core', function () {
    return function (css) {
        css.walk(minimiseWhitespace);
        // Remove final newline
        css.raws.after = '';
    };
});
module.exports = exports['default'];