'use strict';

exports.type = 'perItem';

exports.active = false;

exports.description = 'removes viewBox attribute when possible (disabled by default)';

var regViewBox = /^0\s0\s([\-+]?\d*\.?\d+([eE][\-+]?\d+)?)\s([\-+]?\d*\.?\d+([eE][\-+]?\d+)?)$/,
    viewBoxElems = ['svg', 'pattern'];

/**
 * Remove viewBox attr which coincides with a width/height box.
 *
 * @see http://www.w3.org/TR/SVG/coords.html#ViewBoxAttribute
 *
 * @example
 * <svg width="100" height="50" viewBox="0 0 100 50">
 *             ⬇
 * <svg width="100" height="50">
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 *
 * @author Kir Belevich
 */
exports.fn = function(item) {

    if (
        item.isElem(viewBoxElems) &&
        item.hasAttr('viewBox') &&
        item.hasAttr('width') &&
        item.hasAttr('height')
    ) {

        var match = item.attr('viewBox').value.match(regViewBox);

        if (match) {
            if (
                item.attr('width').value === match[1] &&
                item.attr('height').value === match[3]
            ) {
                item.removeAttr('viewBox');
            }
        }

    }

};
