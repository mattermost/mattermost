// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const path = require('path');

module.exports = {
    process(_src, filename) {
        return {code: `module.exports = ${JSON.stringify(path.basename(filename))};`};
    },
};
