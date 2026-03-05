// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const { sendJSON } = require("../lib/router");

function outgoingWebhookResponse({ body, query, res }) {
    if (!body) {
        sendJSON(res, 404, { error: "Invalid data" });
        return;
    }

    const responseType = query.response_type || "in_channel";
    const username = query.override_username || "";
    const iconUrl = query.override_icon_url || "";

    const payload = Object.entries(body)
        .map(([key, value]) => `- ${key}: "${value}"`)
        .join("\n");

    const text = `
\`\`\`
#### Outgoing Webhook Payload
${payload}
#### Webhook override to Mattermost instance
- response_type: "${responseType}"
- type: ""
- username: "${username}"
- icon_url: "${iconUrl}"
\`\`\`
`;

    sendJSON(res, 200, {
        text,
        username,
        icon_url: iconUrl,
        type: "",
        response_type: responseType,
    });
}

module.exports = { outgoingWebhookResponse };
