'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

function dedupe(root) {
    root.each(function (node) {
        if (node.nodes) {
            dedupe(node);
        }
    });

    if (root.nodes.length < 2) {
        return;
    }

    root.each(function (node, index) {
        if (node.type === 'comment') {
            return;
        }

        var nodes = node.parent.nodes;
        var toString = node.toString();
        var result = [node];

        for (var i = index + 1, max = nodes.length; i < max; i++) {
            if (nodes[i].toString() === toString) {
                result.push(nodes[i]);
            }
        }

        for (var i = result.length - 2; ~i; i -= 1) {
            result[i].remove();
        }
    });
}

exports.default = (0, _postcss.plugin)('postcss-discard-duplicates', function () {
    return dedupe;
});
module.exports = exports['default'];