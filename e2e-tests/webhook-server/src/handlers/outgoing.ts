// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { HandlerArgs } from "../lib/types";

export function outgoingWebhookResponse({ body, query, res }: HandlerArgs): void {
    if (!body) {
        res.status(404).json({ error: "Invalid data" });
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

    res.json({
        text,
        username,
        icon_url: iconUrl,
        type: "",
        response_type: responseType,
    });
}
