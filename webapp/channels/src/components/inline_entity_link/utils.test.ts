// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {InlineEntityTypes} from './constants';
import {parseInlineEntityUrl} from './utils';

describe('parseInlineEntityUrl', () => {
    it('should parse post URL', () => {
        const url = 'http://localhost:8065/team-name/pl/postid123?view=citation';
        const result = parseInlineEntityUrl(url);
        expect(result).toEqual({
            type: InlineEntityTypes.POST,
            postId: 'postid123',
            teamName: 'team-name',
            channelName: '',
        });
    });

    it('should parse channel URL', () => {
        const url = 'http://localhost:8065/team-name/channels/channel-name?view=citation';
        const result = parseInlineEntityUrl(url);
        expect(result).toEqual({
            type: InlineEntityTypes.CHANNEL,
            postId: '',
            teamName: 'team-name',
            channelName: 'channel-name',
        });
    });

    it('should parse team URL', () => {
        const url = 'http://localhost:8065/team-name?view=citation';
        const result = parseInlineEntityUrl(url);
        expect(result).toEqual({
            type: InlineEntityTypes.TEAM,
            postId: '',
            teamName: 'team-name',
            channelName: '',
        });
    });

    it('should return null type for invalid URL', () => {
        const url = 'http://localhost:8065/invalid';
        const result = parseInlineEntityUrl(url);
        expect(result.type).toBeNull();
    });
});

