'use strict';

var ELEM_SEP = ':';

exports.type = 'perItem';

exports.active = false;

exports.description = 'removes specified attributes';

exports.params = {
    attrs: []
};

/**
 * Remove attributes
 *
 * @param attrs:
 *
 *   format: [ element* : attribute* ]
 *
 *   element   : regexp (wrapped into ^...$), single * or omitted > all elements
 *   attribute : regexp (wrapped into ^...$)
 *
 *   examples:
 *
 *     > basic: remove fill attribute
 *     ---
 *     removeAttrs:
 *       attrs: 'fill'
 *
 *     > remove fill attribute on path element
 *     ---
 *       attrs: 'path:fill'
 *
 *
 *     > remove all fill and stroke attribute
 *     ---
 *       attrs:
 *         - 'fill'
 *         - 'stroke'
 *
 *     [is same as]
 *
 *       attrs: '(fill|stroke)'
 *
 *     [is same as]
 *
 *       attrs: '*:(fill|stroke)'
 *
 *     [is same as]
 *
 *       attrs: '.*:(fill|stroke)'
 *
 *
 *     > remove all stroke related attributes
 *     ----
 *     attrs: 'stroke.*'
 *
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 * @return {Boolean} if false, item will be filtered out
 *
 * @author Benny Schudel
 */
exports.fn = function(item, params) {

        // wrap into an array if params is not
    if (!Array.isArray(params.attrs)) {
        params.attrs = [params.attrs];
    }

    if (item.isElem()) {

            // prepare patterns
        var patterns = params.attrs.map(function(pattern) {

                // apply to all elements if specifc element is omitted
            if (pattern.indexOf(ELEM_SEP) === -1) {
                pattern = ['.*', ELEM_SEP, pattern].join('');
            }

                // create regexps for element and attribute name
            return pattern.split(ELEM_SEP)
                .map(function(value) {

                        // adjust single * to match anything
                    if (value === '*') { value = '.*'; }

                    return new RegExp(['^', value, '$'].join(''), 'i');
                });

        });

            // loop patterns
        patterns.forEach(function(pattern) {

                // matches element
            if (pattern[0].test(item.elem)) {

                    // loop attributes
                item.eachAttr(function(attr) {
                    var name = attr.name;

                        // matches attribute name
                    if (pattern[1].test(name)) {
                        item.removeAttr(name);
                    }

                });

            }

        });

    }

};
