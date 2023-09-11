// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {StoragePrefixes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {makeGetDrafts, makeGetDraftsByPrefix, makeGetDraftsCount} from './drafts';

const currentUserId = 'currentUserId';
const currentChannelId = 'channelId';
const rootId = 'rootId';
const currentTeamId = 'teamId';
const initialState = {
    entities: {
        users: {
            currentUserId,
            profiles: {
                currentUserId: {
                    id: currentUserId,
                    roles: 'system_role',
                },
            },
        },
        channels: {
            currentChannelId,
            channels: {
                currentChannelId: {id: currentChannelId, team_id: currentTeamId},
            },
            channelsInTeam: {
                currentTeamId: [currentChannelId],
            },
            myMembers: {
                currentChannelId: {
                    channel_id: currentChannelId,
                    user_id: currentUserId,
                    roles: 'channel_role',
                    mention_count: 1,
                    msg_count: 9,
                },
            },
        },
        teams: {
            currentTeamId,
            teams: {
                currentTeamId: {
                    id: currentTeamId,
                    name: 'team-1',
                    displayName: 'Team 1',
                },
            },
            myMembers: {
                currentTeamId: {roles: 'team_role'},
            },
        },
        general: {
            config: {},
        },
        preferences: {
            myPreferences: {},
        },
    },
} as unknown as GlobalState;

const commentDrafts = [
    {
        message: 'comment_draft',
        fileInfos: [],
        uploadsInProgress: [],
        channelId: currentChannelId,
        rootId,
        show: true,
    },
];

const channelDrafts = [
    {
        message: 'channel_draft',
        fileInfos: [],
        uploadsInProgress: [],
        channelId: currentChannelId,
        show: true,
    },
];

const state = mergeObjects(initialState, {
    storage: {
        storage: {
            [`${StoragePrefixes.COMMENT_DRAFT}${rootId}`]: {
                value: commentDrafts[0],
                timestamp: new Date('2022-11-20T23:21:53.552Z'),
            },
            [`${StoragePrefixes.DRAFT}${currentChannelId}`]: {
                value: channelDrafts[0],
                timestamp: new Date('2022-11-20T23:21:53.552Z'),
            },
        },
    },
});

const expectedCommentDrafts = [
    {
        id: rootId,
        key: `${StoragePrefixes.COMMENT_DRAFT}${rootId}`,
        type: 'thread',
        timestamp: new Date('2022-11-20T23:21:53.552Z'),
        value: commentDrafts[0],
    },
];

const expectedChannelDrafts = [
    {
        id: currentChannelId,
        key: `${StoragePrefixes.DRAFT}${currentChannelId}`,
        type: 'channel',
        timestamp: new Date('2022-11-20T23:21:53.552Z'),
        value: channelDrafts[0],
    },
];

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getMyActiveChannelIds: () => currentChannelId,
}));

describe('makeGetDraftsByPrefix', () => {
    it('should return comment drafts when given the comment_draft prefix', () => {
        const getDraftsByPrefix = makeGetDraftsByPrefix(StoragePrefixes.COMMENT_DRAFT);
        const drafts = getDraftsByPrefix(state);

        expect(drafts).toEqual(expectedCommentDrafts);
    });

    it('should return channel drafts when given the comment_draft prefix', () => {
        const getDraftsByPrefix = makeGetDraftsByPrefix(StoragePrefixes.DRAFT);
        const drafts = getDraftsByPrefix(state);

        expect(drafts).toEqual(expectedChannelDrafts);
    });
});

describe('makeGetDrafts', () => {
    it('should return all drafts', () => {
        const getDrafts = makeGetDrafts();
        const drafts = getDrafts(state);

        expect(drafts).toEqual([...expectedChannelDrafts, ...expectedCommentDrafts]);
    });
});

describe('makeGetDraftsCount', () => {
    it('should return drafts count', () => {
        const getDraftsCount = makeGetDraftsCount();
        const draftCount = getDraftsCount(state);

        expect(draftCount).toEqual([...expectedChannelDrafts, ...expectedCommentDrafts].length);
    });
});
