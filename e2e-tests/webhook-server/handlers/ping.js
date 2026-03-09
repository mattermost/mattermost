// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const { sendJSON } = require("../lib/router");

function ping({ res, meta }) {
    sendJSON(res, 200, {
        message: "I'm alive!",
        services: meta.listServices(),
    });
}

module.exports = { ping };
