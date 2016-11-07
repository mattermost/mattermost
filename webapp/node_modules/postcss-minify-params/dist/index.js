var postcss = require('postcss');
var valueParser = require('postcss-value-parser');
var stringify = valueParser.stringify;
var sort = require('alphanum-sort');
var uniqs = require('uniqs');

function split(nodes, div) {
    var result = [];
    var i, max, node;
    var last = '';

    for (i = 0, max = nodes.length; i < max; i += 1) {
        node = nodes[i];
        if (node.type === 'div' && node.value === div) {
            result.push(last);
            last = '';
        } else {
            last += stringify(node);
        }
    }

    result.push(last);

    return result;
}

module.exports = postcss.plugin('postcss-minify-params', function () {
    return function (css) {
        css.walkAtRules(function (rule) {
            if (!rule.params) {
                return;
            }

            var params = valueParser(rule.params);

            params.walk(function (node) {
                if (node.type === 'div' || node.type === 'function') {
                    node.before = node.after = '';
                } else if (node.type === 'space') {
                    node.value = ' ';
                }
            }, true);

            rule.params = sort(uniqs(split(params.nodes, ',')), {
                insensitive: true
            }).join();
        });
    };
});
