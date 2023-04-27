// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const extractZip = require('extract-zip');
const shell = require('shelljs');

const shellFind = ({path, pattern}) => {
    return shell.find(path).filter((file) => {
        return file.match(pattern);
    });
};

const shellRm = ({option, file}) => {
    return shell.rm(option, file);
};

const shellUnzip = async ({source, target}) => {
    try {
        await extractZip(source, {dir: target});
        return null;
    } catch (err) {
        return err;
    }
};

module.exports = {
    shellFind,
    shellRm,
    shellUnzip,
};
