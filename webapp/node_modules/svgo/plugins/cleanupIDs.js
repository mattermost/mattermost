'use strict';

exports.type = 'full';

exports.active = true;

exports.description = 'removes unused IDs and minifies used';

exports.params = {
    remove: true,
    minify: true,
    prefix: ''
};

var referencesProps = require('./_collections').referencesProps,
    regReferencesUrl = /\burl\(("|')?#(.+?)\1\)/,
    regReferencesHref = /^#(.+?)$/,
    regReferencesBegin = /^(\w+?)\./,
    styleOrScript = ['style', 'script'],
    generateIDchars = [
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
        'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
    ],
    maxIDindex = generateIDchars.length - 1;

/**
 * Remove unused and minify used IDs
 * (only if there are no any <style> or <script>).
 *
 * @param {Object} item current iteration item
 * @param {Object} params plugin params
 *
 * @author Kir Belevich
 */
exports.fn = function(data, params) {

    var currentID,
        currentIDstring,
        IDs = Object.create(null),
        referencesIDs = Object.create(null),
        idPrefix = 'id-', // prefix IDs so that values like '__proto__' don't break the work
        hasStyleOrScript = false;

    /**
     * Bananas!
     *
     * @param {Array} items input items
     * @return {Array} output items
     */
    function monkeys(items) {

        for (var i = 0; i < items.content.length && !hasStyleOrScript; i++) {

            var item = items.content[i],
                match;

            // check if <style> of <script> presents
            if (item.isElem(styleOrScript)) {
                hasStyleOrScript = true;
                continue;
            }

            // …and don't remove any ID if yes
            if (item.isElem()) {

                item.eachAttr(function(attr) {
                    var key;
                    // save IDs
                    if (attr.name === 'id') {
                        key = idPrefix + attr.value;
                        if (key in IDs) {
                            item.removeAttr('id');
                        } else {
                            IDs[key] = item;
                        }
                    }

                    // save IDs url() references
                    else if (referencesProps.indexOf(attr.name) > -1) {
                        match = attr.value.match(regReferencesUrl);

                        if (match) {
                            key = idPrefix + match[2];
                            if (referencesIDs[key]) {
                                referencesIDs[key].push(attr);
                            } else {
                                referencesIDs[key] = [attr];
                            }
                        }
                    }

                    // save IDs href references
                    else if (
                        attr.local === 'href' && (match = attr.value.match(regReferencesHref)) ||
                        attr.name === 'begin' && (match = attr.value.match(regReferencesBegin))
                    ) {
                        key = idPrefix + match[1];
                        if (referencesIDs[key]) {
                            referencesIDs[key].push(attr);
                        } else {
                            referencesIDs[key] = [attr];
                        }
                    }
                });

            }

            // go deeper
            if (item.content) {
                monkeys(item);
            }
        }

        return items;

    }

    data = monkeys(data);

    if (hasStyleOrScript) {
        return data;
    }

    var idKey;
    for (var k in referencesIDs) {
        if (IDs[k]) {
            idKey = k;
            k = k.replace(idPrefix, '');
            // replace referenced IDs with the minified ones
            if (params.minify) {
                currentIDstring = getIDstring(currentID = generateID(currentID), params);
                IDs[idKey].attr('id').value = currentIDstring;

                referencesIDs[idKey].forEach(function(attr) {
                    attr.value = attr.value
                        .replace('#' + k, '#' + currentIDstring)
                        .replace(k + '.', currentIDstring + '.');
                });

                idKey = idPrefix + k;
            }

            // don't remove referenced IDs
            delete IDs[idKey];
        }
    }

    // remove non-referenced IDs attributes from elements
    if (params.remove) {

        for(var ID in IDs) {
            IDs[ID].removeAttr('id');
        }

    }

    return data;

};

/**
 * Generate unique minimal ID.
 *
 * @param {Array} [currentID] current ID
 * @return {Array} generated ID array
 */
function generateID(currentID) {

    if (!currentID) return [0];

    currentID[currentID.length - 1]++;

    for(var i = currentID.length - 1; i > 0; i--) {
        if (currentID[i] > maxIDindex) {
            currentID[i] = 0;

            if (currentID[i - 1] !== undefined) {
                currentID[i - 1]++;
            }
        }
    }

    if (currentID[0] > maxIDindex) {
        currentID[0] = 0;
        currentID.unshift(0);
    }

    return currentID;

}

/**
 * Get string from generated ID array.
 *
 * @param {Array} arr input ID array
 * @return {String} output ID string
 */
function getIDstring(arr, params) {

    var str = params.prefix;

    arr.forEach(function(i) {
        str += generateIDchars[i];
    });

    return str;

}
