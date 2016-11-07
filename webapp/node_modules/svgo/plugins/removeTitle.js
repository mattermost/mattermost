'use strict';

exports.type = 'perItem';

exports.active = false;

exports.description = 'removes <title> (disabled by default)';

/**
 * Remove <title>.
 * Disabled by default cause it may be used for accessibility.
 *
 * https://developer.mozilla.org/en-US/docs/Web/SVG/Element/title
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 *
 * @author Igor Kalashnikov
 */
exports.fn = function(item) {

    return !item.isElem('title');

};
