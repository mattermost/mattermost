// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Custom formatjs formatter for src/i18n/en.json
 *
 * Each entry pairs the `defaultMessage` with a `description` explaining where
 * the string appears and how it is used. The description is context for
 * translators, human or AI; it is never shipped to the client, because nothing
 * in the bundle imports en.json -- react-intl renders English from the
 * `defaultMessage` compiled into each call site.
 *
 * Descriptions are rarely written in source and the curated ones are the point
 * of the file, so the existing catalog is merged in rather than overwritten: a
 * description written in source wins, otherwise the recorded one is carried
 * forward, and a key with neither lands with an empty string to fill in. The
 * merge always reads the canonical catalog, never --out-file, so that
 * i18n-extract:check can extract to a temporary file and still compare like
 * for like.
 *
 * Sorting is case-insensitive with underscore before dot, matching mmjstool's
 * sortJson({ignoreCase: true}).
 */

const fs = require('fs');
const path = require('path');

const CATALOG = path.join(__dirname, '..', 'src', 'i18n', 'en.json');

function readCatalog() {
    try {
        return JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
    } catch (e) {
        if (e.code === 'ENOENT') {
            return {};
        }
        throw e;
    }
}

module.exports.format = (msgs) => {
    const existing = readCatalog();

    return Object.keys(msgs).reduce((all, k) => {
        // A defaultMessage built from a runtime expression extracts as
        // undefined. There is then nothing to translate, and -- since English
        // renders from the defaultMessage rather than from this file -- nothing
        // to fall back to either, so the id would render as itself. Fail here
        // rather than emit an entry that is missing the only field that
        // matters: this runs over every extracted path, including
        // platform/shared, which the formatjs lint rules do not cover.
        if (msgs[k].defaultMessage === undefined) {
            throw new Error(
                `${k}: defaultMessage is not a string literal, so it cannot be extracted. ` +
                'Give the message a literal defaultMessage, or render the runtime value directly ' +
                'instead of wrapping it in a message.',
            );
        }

        all[k] = {
            defaultMessage: msgs[k].defaultMessage,
            description: msgs[k].description || (existing[k] && existing[k].description) || '',
        };
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
