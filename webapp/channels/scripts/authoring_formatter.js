// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * formatjs formatter for the authoring-tier catalog in src/i18n-authoring/.
 *
 * Where scripts/formatter.js flattens each message down to its defaultMessage
 * for the shipped en.json, this one keeps the translator-facing description
 * alongside it.
 *
 * Descriptions are rarely written in source, and the curated ones are the
 * reason the file exists, so the existing catalog is merged in rather than
 * overwritten: a description written in source wins, otherwise the recorded
 * one is carried forward, and a key with neither lands with an empty string to
 * fill in. The merge always reads the canonical catalog, never --out-file, so
 * that the :check variant can extract to a temporary file and still compare
 * like for like.
 */

const fs = require('fs');
const path = require('path');

const {compareMessages} = require('./formatter');

const CATALOG = path.join(__dirname, '..', 'src', 'i18n-authoring', 'en-with-description.json');

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
        // A message whose defaultMessage is a runtime expression extracts with
        // no defaultMessage at all. JSON.stringify drops the undefined and so
        // those ids never reach en.json; skip them here too, otherwise this
        // catalog would carry ids the shipped one does not have.
        if (msgs[k].defaultMessage === undefined) {
            return all;
        }

        all[k] = {
            defaultMessage: msgs[k].defaultMessage,
            description: msgs[k].description || (existing[k] && existing[k].description) || '',
        };
        return all;
    }, {});
};

module.exports.compile = (msgs) => msgs;

// Match en.json's ordering so the two files stay diffable side by side.
module.exports.compareMessages = compareMessages;
