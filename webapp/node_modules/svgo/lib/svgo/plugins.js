'use strict';

/**
 * Plugins engine.
 *
 * @module plugins
 *
 * @param {Object} data input data
 * @param {Object} plugins plugins object from config
 * @return {Object} output data
 */
module.exports = function(data, plugins) {

    plugins.forEach(function(group) {

        switch(group[0].type) {
            case 'perItem':
                data = perItem(data, group);
                break;
            case 'perItemReverse':
                data = perItem(data, group, true);
                break;
            case 'full':
                data = full(data, group);
                break;
        }

    });

    return data;

};

/**
 * Direct or reverse per-item loop.
 *
 * @param {Object} data input data
 * @param {Array} plugins plugins list to process
 * @param {Boolean} [reverse] reverse pass?
 * @return {Object} output data
 */
function perItem(data, plugins, reverse) {

    function monkeys(items) {

        items.content = items.content.filter(function(item) {

            // reverse pass
            if (reverse && item.content) {
                monkeys(item);
            }

            // main filter
            var filter = true;

            for (var i = 0; filter && i < plugins.length; i++) {
                var plugin = plugins[i];

                if (plugin.active && plugin.fn(item, plugin.params) === false) {
                    filter = false;
                }
            }

            // direct pass
            if (!reverse && item.content) {
                monkeys(item);
            }

            return filter;

        });

        return items;

    }

    return monkeys(data);

}

/**
 * "Full" plugins.
 *
 * @param {Object} data input data
 * @param {Array} plugins plugins list to process
 * @return {Object} output data
 */
function full(data, plugins) {

    plugins.forEach(function(plugin) {
        if (plugin.active) {
            data = plugin.fn(data, plugin.params);
        }
    });

    return data;

}
