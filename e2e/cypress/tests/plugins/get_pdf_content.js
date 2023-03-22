// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');

const pdf = require('pdf-parse');

/**
 * Checks whether a file exist in the tests/downloads folder and return the content of it.
 * @param {string} filePath - pdf file path
 */
module.exports = async (filePath) => {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data;
};
