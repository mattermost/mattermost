'use strict';

exports.__esModule = true;

var _postcss = require('postcss');

function discardAndReport(css, result) {
    function discardEmpty(node) {
        var type = node.type;
        var sub = node.nodes;


        if (sub) {
            node.each(discardEmpty);
        }

        if (type === 'decl' && !node.value || type === 'rule' && !node.selector || sub && !sub.length || type === 'atrule' && (!sub && !node.params || !node.params && !sub.length)) {
            node.remove();

            result.messages.push({
                type: 'removal',
                plugin: 'postcss-discard-empty',
                node: node
            });
        }
    }

    css.each(discardEmpty);
}

exports.default = (0, _postcss.plugin)('postcss-discard-empty', function () {
    return function (css, result) {
        return discardAndReport(css, result);
    };
});
module.exports = exports['default'];