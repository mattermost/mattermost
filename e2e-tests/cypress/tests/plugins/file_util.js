// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');
const path = require('path');

/**
 * Checks whether a file exist in the fixtures folder
 * @param {string} filename - filename to check if it exists
 */
const fileExist = (filename) => {
    const filePath = path.resolve(__dirname, `../fixtures/${filename}`);

    return fs.existsSync(filePath);
};

/**
 * Write data to a file in the fixtures folder
 * @param {string} filename - filename where to write data into
 * @param {string} fixturesFolder - folder at tests/fixtures
 * @param {string} data - The data to write
 */
const writeToFile = ({filename, fixturesFolder, data = ''}) => {
    const folder = path.resolve(__dirname, `../fixtures/${fixturesFolder}`);
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, {recursive: true});
    }

    const filePath = `${folder}/${filename}`;

    fs.writeFileSync(filePath, data);
    return null;
};

/**
 * Append React development warnings (e.g. those emitted by StrictMode) captured during a test to a
 * log file so they can be collected after the run. Each entry is written as a single JSON line.
 * @param {string} spec - the spec file the warnings were captured in
 * @param {Array<{method: string, test: string, message: string}>} warnings - captured warnings
 */
const appendReactWarnings = ({spec, warnings = []}) => {
    if (!warnings.length) {
        return null;
    }

    const folder = path.resolve(__dirname, '../../logs');
    if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, {recursive: true});
    }

    const filePath = `${folder}/react-warnings.log`;
    const lines = warnings.map((warning) => JSON.stringify({spec, ...warning})).join('\n') + '\n';

    fs.appendFileSync(filePath, lines);
    return null;
};

module.exports = {
    fileExist,
    writeToFile,
    appendReactWarnings,
};
