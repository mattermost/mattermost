'use strict';

exports.type = 'perItem';

exports.active = true;

exports.params = {
    removeAny: false
};

exports.description = 'removes <desc> (only non-meaningful by default)';

var standardDescs = /^Created with/;

/**
 * Removes <desc>.
 * Removes only standard editors content or empty elements 'cause it can be used for accessibility.
 * Enable parameter 'removeAny' to remove any description.
 *
 * https://developer.mozilla.org/en-US/docs/Web/SVG/Element/desc
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 *
 * @author Daniel Wabyick
 */
exports.fn = function(item, params) {

    return !item.isElem('desc') || !(params.removeAny || item.isEmpty() ||
            standardDescs.test(item.content[0].text));

};
