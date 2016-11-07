var postcss = require('postcss');

module.exports = postcss.plugin('postcss-normalize-charset', function (opts) {
    opts = opts || {};

    return function (css) {
        var charsetRule;
        var nonAsciiNode;
        var nonAscii = /[^\x00-\x7F]/;

        css.walk(function (node) {
            if (node.type === 'atrule' && node.name === 'charset') {
                if (!charsetRule) {
                    charsetRule = node;
                }
                node.remove();
            } else if (!nonAsciiNode && node.parent && node.parent.type === 'root' && nonAscii.test(node)) {
                nonAsciiNode = node;
            }
        });

        if (nonAsciiNode) {
            if (!charsetRule && opts.add !== false) {
                charsetRule = postcss.atRule({
                    name: 'charset',
                    params: '"utf-8"'
                });
            }
            if (charsetRule) {
                charsetRule.source = nonAsciiNode.source;
                css.root().prepend(charsetRule);
            }
        }
    };
});
