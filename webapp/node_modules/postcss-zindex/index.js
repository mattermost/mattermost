'use strict';

var postcss = require('postcss');

module.exports = postcss.plugin('postcss-zindex', function () {
    return function (css) {
        var cache = require('./lib/layerCache')();
        var nodes = [];
        var abort = false;
        // First pass; cache all z indexes
        css.walkDecls('z-index', function (decl) {
            if (abort) {
                return;
            }
            // Check that no negative values exist. Rebasing is only
            // safe if all indices are positive numbers.
            if (decl.value[0] === '-') {
                abort = true;
                return;
            }
            nodes.push(decl);
            cache.addValue(decl.value);
        });
        
        // Abort rebasing altogether due to z-index being found
        if (abort) {
            return;
        }

        cache.optimizeValues();

        // Second pass; optimize
        nodes.forEach(function (decl) {
            // Need to coerce to string so that the
            // AST is updated correctly
            var value = cache.getValue(decl.value);
            decl.value = String(value);
        });
    };
});
