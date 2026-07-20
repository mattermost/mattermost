// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {makeGetDrafts, makeGetDraftsByPrefix, makeGetDraftsCount, makeGetDraft} from './drafts';

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
                currentTeamId: new Set([currentChannelId]),
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

describe('makeGetDraft', () => {
    const getDraft = makeGetDraft();

    let initialStore: GlobalState;

    const channelId1 = TestHelper.getChannelMock({id: 'channelId1'}).id;
    const channelId2 = TestHelper.getChannelMock({id: 'channelId2'}).id;
    const draft1 = TestHelper.getPostDraftMock({message: 'draft 1 with channelId 1', channelId: channelId1});
    const draft2 = TestHelper.getPostDraftMock({message: 'draft 2 with channelId 2', channelId: channelId2});

    beforeEach(() => {
        initialStore = {storage: {storage: {
            [StoragePrefixes.DRAFT + channelId1]: {
                timestamp: Date.now(),
                value: draft1,
            },
            [StoragePrefixes.DRAFT + channelId2]: {
                timestamp: Date.now(),
                value: draft2,
            },
        }}} as unknown as GlobalState;
    });

    test('should return a draft with the correct fields', () => {
        const draft = getDraft(initialStore, channelId1);
        expect(draft).toEqual(draft1);
    });

    test('should return draft with correct fields even if some fields are missing from drafts in storage', () => {
        const store = cloneDeep(initialStore);
        delete store.storage.storage[StoragePrefixes.DRAFT + channelId1].value.message;
        delete store.storage.storage[StoragePrefixes.DRAFT + channelId1].value.fileInfos;
        delete store.storage.storage[StoragePrefixes.DRAFT + channelId1].value.uploadsInProgress;

        const draft = getDraft(store, channelId1);
        expect(draft.message).toBeDefined();
        expect(draft.fileInfos).toBeDefined();
        expect(draft.uploadsInProgress).toBeDefined();
    });

    test('should return a draft with the correct fields even if the draft\'s channelId or rootId mismatches with the passed one', () => {
        const store = cloneDeep(initialStore);

        // Change the channelId and rootId of the draft in storage of the draft
        store.storage.storage[StoragePrefixes.DRAFT + channelId2].value.channelId = 'channelId1New';
        store.storage.storage[StoragePrefixes.DRAFT + channelId2].value.rootId = 'rootId1';

        const draft = getDraft(store, channelId2);

        // Verify that the draft has the correct fields by which it is returned
        expect(draft).toEqual(draft2);
    });
});
