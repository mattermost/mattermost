// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type { HandlerArgs } from "../lib/types";

export function slackCompatibleResponse({ body, res }: HandlerArgs): void {
    const { spoiler, skipSlackParsing } = body?.context ?? {};

    res.json({
        ephemeral_text: spoiler,
        skip_slack_parsing: skipSlackParsing,
    });
}

export function messageInChannel({ query, res }: HandlerArgs): void {
    const channelId = query["channel-id"];
    const response: Record<string, any> = {
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

    res.json(response);
}
