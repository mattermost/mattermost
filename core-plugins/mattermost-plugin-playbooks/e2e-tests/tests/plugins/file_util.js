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

module.exports = {
    fileExist,
    writeToFile,
};
