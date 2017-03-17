'use strict';

exports.type = 'full';

exports.active = false;

exports.description = 'adds attributes to an outer <svg> element';

var ENOCLS = 'Error in plugin "addAttributesToSVGElement": absent parameters.\n\
It should have a list of classes in "attributes" or one "attribute".\n\
Config example:\n\n\
\
plugins:\n\
- addAttributesToSVGElement:\n\
    attribute: "mySvg"\n\n\
\
plugins:\n\
- addAttributesToSVGElement:\n\
    attributes: ["mySvg", "size-big"]\n';

/**
 * Add attributes to an outer <svg> element. Example config:
 *
 * plugins:
 * - addAttributesToSVGElement:
 *     attribute: 'data-icon'
 *
 * plugins:
 * - addAttributesToSVGElement:
 *     attributes: ['data-icon', 'data-disabled']
 *
 * @author April Arcus
 */
exports.fn = function(data, params) {
    if (!params || !(Array.isArray(params.attributes) && params.attributes.some(String) || params.attribute)) {
        console.error(ENOCLS);
        return data;
    }

    var attributes = params.attributes || [ params.attribute ],
        svg = data.content[0];

    if (svg.isElem('svg')) {
        attributes.forEach(function (attribute) {
            if (!svg.hasAttr(attribute)) {
                svg.addAttr({
                    name: attribute,
                    prefix: '',
                    local: attribute
                });
            }
        });
    }

    return data;

};
