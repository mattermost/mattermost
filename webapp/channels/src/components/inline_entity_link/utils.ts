// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {InlineEntityType} from './constants';
import {InlineEntityTypes} from './constants';

export type ParsedInlineEntity = {
    type: InlineEntityType | null;
    postId: string;
    teamName: string;
    channelName: string;
};

export function parseInlineEntityUrl(url: string): ParsedInlineEntity {
    let type: InlineEntityType | null = null;
    let postId = '';
    let teamName = '';
    let channelName = '';

    try {
        const urlObj = new URL(url, 'http://example.com');
        if (urlObj.searchParams.get('view') !== 'citation') {
            return {
                type: null,
                postId,
                teamName,
                channelName,
            };
        }
    } catch (e) {
        return {
            type: null,
            postId,
            teamName,
            channelName,
        };
    }

    // Extract info from URL
    // Matches:
    // POST: .../pl/<id>
    // CHANNEL: .../<team>/channels/<channel>
    // TEAM: .../<team>

    // Remove query params for matching
    const urlWithoutQuery = url.split('?')[0];

    const postMatch = (/\/([a-z0-9\-_]+)\/pl\/([a-z0-9]+)/).exec(urlWithoutQuery);
    if (postMatch) {
        type = InlineEntityTypes.POST;
        teamName = postMatch[1];
        postId = postMatch[2];
    } else {
        const channelMatch = (/\/([a-z0-9\-_]+)\/channels\/([a-z0-9\-__][a-z0-9\-__.]+)/).exec(urlWithoutQuery);
        if (channelMatch) {
            type = InlineEntityTypes.CHANNEL;
            teamName = channelMatch[1];
            channelName = channelMatch[2];
        } else {
            // Fallback for team link if it matches the pattern but isn't a channel/post
            const teamMatch = (/\/([a-z0-9\-_]+)$/).exec(urlWithoutQuery);
            if (teamMatch) {
                type = InlineEntityTypes.TEAM;
                teamName = teamMatch[1];
            }
        }
    }

    return {
        type,
        postId,
        teamName,
        channelName,
    };
}
