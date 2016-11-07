'use strict';

exports.type = 'perItem';

exports.active = true;

exports.description = 'removes elements in <defs> without id';

var nonRendering = require('./_collections').elemsGroups.nonRendering,
    defs;

/**
 * Removes content of defs and properties that aren't rendered directly without ids.
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 *
 * @author Lev Solntsev
 */
exports.fn = function(item) {

    if (item.isElem('defs')) {

        defs = item;
        item.content = (item.content || []).reduce(getUsefulItems, []);

        if (item.isEmpty()) return false;

    } else if (item.isElem(nonRendering) && !item.hasAttr('id')) {

        return false;

    }

};

function getUsefulItems(usefulItems, item) {

    if (item.hasAttr('id') || item.isElem('style')) {

        usefulItems.push(item);
        item.parentNode = defs;

    } else if (!item.isEmpty()) {

        item.content.reduce(getUsefulItems, usefulItems);

    }

    return usefulItems;
}
