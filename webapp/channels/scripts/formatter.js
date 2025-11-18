// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Custom formatjs formatter matching mmjstool's behavior
 *
 * Based on formatjs simple formatter with case-insensitive sorting
 * to match mmjstool's sortJson({ignoreCase: true})
 */

/**
 * Format function - extract defaultMessage from message objects
 * Same as formatjs simple formatter
 */
module.exports.format = (msgs) => {
    return Object.keys(msgs).reduce((all, k) => {
        all[k] = msgs[k].defaultMessage;
        return all;
    }, {});
};

/**
 * Compile function - pass through (identity)
 * Same as formatjs simple formatter
 */
module.exports.compile = (msgs) => msgs;

/**
 * Custom comparator for case-insensitive alphabetical sorting
 * with underscore before dot (to match existing en.json ordering)
 */
module.exports.compareMessages = (el1, el2) => {
    // Normalize keys: replace _ with a character that sorts before .
    // Use \x00 (null char) which sorts before all printable characters
    const key1 = el1.key.toLowerCase().replace(/_/g, '\x00');
    const key2 = el2.key.toLowerCase().replace(/_/g, '\x00');

    if (key1 < key2) {
        return -1;
    }
    if (key1 > key2) {
        return 1;
    }
    return 0;
};
