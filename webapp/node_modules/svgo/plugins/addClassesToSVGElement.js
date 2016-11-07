'use strict';

exports.type = 'full';

exports.active = false;

exports.description = 'adds classnames to an outer <svg> element';

var ENOCLS = 'Error in plugin "addClassesToSVGElement": absent parameters.\n\
It should have a list of classes in "classNames" or one "className".\n\
Config example:\n\n\
\
plugins:\n\
- addClassesToSVGElement:\n\
    className: "mySvg"\n\n\
\
plugins:\n\
- addClassesToSVGElement:\n\
    classNames: ["mySvg", "size-big"]\n';

/**
 * Add classnames to an outer <svg> element. Example config:
 *
 * plugins:
 * - addClassesToSVGElement:
 *     className: 'mySvg'
 *
 * plugins:
 * - addClassesToSVGElement:
 *     classNames: ['mySvg', 'size-big']
 *
 * @author April Arcus
 */
exports.fn = function(data, params) {
    if (!params || !(Array.isArray(params.classNames) && params.classNames.some(String) || params.className)) {
        console.error(ENOCLS);
        return data;
    }

    var classNames = params.classNames || [ params.className ],
        svg = data.content[0];

    if (svg.isElem('svg')) {
        if (svg.hasAttr('class')) {
            var classes = svg.attr('class').value.split(' ');
            classNames.forEach(function(className){
                if (classes.indexOf(className) < 0) {
                    classes.push(className);
                }
            });
            svg.attr('class').value = classes.join(' ');
        } else {
            svg.addAttr({
                name: 'class',
                value: classNames.join(' '),
                prefix: '',
                local: 'class'
            });
        }
    }

    return data;

};
