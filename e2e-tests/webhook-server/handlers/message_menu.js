// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const { sendJSON } = require("../lib/router");

function messageMenu({ body, res }) {
    let responseData = {};

    if (body && body.context && body.context.action === "do_something") {
        responseData = {
            ephemeral_text: `Ephemeral | ${body.type} ${body.data_source} option: ${body.context.selected_option}`,
        };
    }

    sendJSON(res, 200, responseData);
}

module.exports = { messageMenu };
