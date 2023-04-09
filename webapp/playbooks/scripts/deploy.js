// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable no-console */

const fs = require('fs');

async function deploy() {
    const target = '../channels/dist/products/playbooks';
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, {recursive: true});
    }
    fs.cpSync('dist', target, {recursive: true});
}

deploy();
