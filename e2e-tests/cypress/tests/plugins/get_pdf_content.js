// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const fs = require('fs');

const {PDFParse} = require('pdf-parse');

/**
 * Checks whether a file exist in the tests/downloads folder and return the content of it.
 * @param {string} filePath - pdf file path
 */
module.exports = async (filePath) => {
    const dataBuffer = fs.readFileSync(filePath);
    const parser = new PDFParse({data: dataBuffer});
    try {
        const text = await parser.getText();
        const info = await parser.getInfo();
        return {text, info, numpages: info.numPages};
    } finally {
        await parser.destroy();
    }
};
