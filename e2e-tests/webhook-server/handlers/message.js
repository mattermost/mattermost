// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const { sendJSON } = require("../lib/router");

function slackCompatibleResponse({ body, res }) {
    const { spoiler, skipSlackParsing } = body.context;

    sendJSON(res, 200, {
        ephemeral_text: spoiler,
        skip_slack_parsing: skipSlackParsing,
    });
}

function sendToChannel({ query, res }) {
    const channelId = query.channel_id;
    const response = {
        response_type: "in_channel",
        text: "Extra response 2",
        channel_id: channelId,
        extra_responses: [
            {
                response_type: "in_channel",
                text: "Hello World",
                channel_id: channelId,
            },
        ],
    };

    if (query.type) {
        response.type = query.type;
    }

    sendJSON(res, 200, response);
}

module.exports = { slackCompatibleResponse, sendToChannel };
