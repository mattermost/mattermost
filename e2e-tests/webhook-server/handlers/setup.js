// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const { sendText } = require("../lib/router");

function setup({ body, context, res }) {
    context.baseUrl = body.baseUrl;
    context.webhookBaseUrl = body.webhookBaseUrl;
    context.adminUsername = body.adminUsername;
    context.adminPassword = body.adminPassword;

    sendText(res, 201, "Successfully setup the new base URLs and credential.");
}

module.exports = { setup };
