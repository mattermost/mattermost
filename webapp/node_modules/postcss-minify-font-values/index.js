var assign = require('object-assign');
var postcss = require('postcss');
var valueParser = require('postcss-value-parser');
var minifyWeight = require('./lib/minify-weight');
var minifyFamily = require('./lib/minify-family');
var minifyFont = require('./lib/minify-font');

function transform(opts) {
    opts = assign({
        removeAfterKeyword: true,
        removeDuplicates: true,
        removeQuotes: true
    }, opts);

    return function (decl) {
        var tree;

        if (decl.type === 'decl') {
            if (decl.prop === 'font-weight') {
                decl.value = minifyWeight(decl.value, opts);
            } else if (decl.prop === 'font-family') {
                tree = valueParser(decl.value);
                tree.nodes = minifyFamily(tree.nodes, opts);
                decl.value = tree.toString();
            } else if (decl.prop === 'font') {
                tree = valueParser(decl.value);
                tree.nodes = minifyFont(tree.nodes, opts);
                decl.value = tree.toString();
            }
        }
    };
}

module.exports = postcss.plugin('postcss-minify-font-values', function (opts) {
    return function (css) {
        css.walk(transform(opts));
    };
});
