// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {StoragePrefixes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {makeGetDraft} from 'selectors/drafts';

const currentUserId = 'currentUserId';
const currentChannelId = 'channelId';
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

jest.mock('mattermost-redux/selectors/entities/channels', () => ({
    getMyActiveChannelIds: () => currentChannelId,
}));

describe('makeGetDraft - spoiler file extraction', () => {
    const getDraft = makeGetDraft();

    test('should extract spoilerFileIds from post props.spoiler_files when editing', () => {
        const draft = TestHelper.getPostDraftMock({
            message: 'test message',
            channelId: currentChannelId,
            props: {
                spoiler_files: {
                    file_id_1: true,
                    file_id_2: true,
                },
            },
        });

        const state = mergeObjects(initialState, {
            storage: {
                storage: {
                    [`${StoragePrefixes.DRAFT}${currentChannelId}`]: {
                        timestamp: Date.now(),
                        value: draft,
                    },
                },
            },
        });

        const result = getDraft(state, currentChannelId);

        expect(result.spoilerFileIds).toBeDefined();
        expect(result.spoilerFileIds).toHaveLength(2);
        expect(result.spoilerFileIds).toContain('file_id_1');
        expect(result.spoilerFileIds).toContain('file_id_2');
    });

    test('should not set spoilerFileIds when post props has no spoiler_files', () => {
        const draft = TestHelper.getPostDraftMock({
            message: 'test message',
            channelId: currentChannelId,
        });

        const state = mergeObjects(initialState, {
            storage: {
                storage: {
                    [`${StoragePrefixes.DRAFT}${currentChannelId}`]: {
                        timestamp: Date.now(),
                        value: draft,
                    },
                },
            },
        });

        const result = getDraft(state, currentChannelId);

        expect(result.spoilerFileIds).toBeUndefined();
    });

    test('should not overwrite existing spoilerFileIds on draft', () => {
        const draft = TestHelper.getPostDraftMock({
            message: 'test message',
            channelId: currentChannelId,
            spoilerFileIds: ['existing_file_id'],
        });

        const state = mergeObjects(initialState, {
            storage: {
                storage: {
                    [`${StoragePrefixes.DRAFT}${currentChannelId}`]: {
                        timestamp: Date.now(),
                        value: draft,
                    },
                },
            },
        });

        const result = getDraft(state, currentChannelId);

        // Should keep existing spoilerFileIds, not extract from props
        expect(result.spoilerFileIds).toEqual(['existing_file_id']);
    });

    test('should handle spoiler_files with false values', () => {
        const draft = TestHelper.getPostDraftMock({
            message: 'test message',
            channelId: currentChannelId,
            props: {
                spoiler_files: {
                    file_id_1: true,
                    file_id_2: false,
                    file_id_3: true,
                },
            },
        });

        const state = mergeObjects(initialState, {
            storage: {
                storage: {
                    [`${StoragePrefixes.DRAFT}${currentChannelId}`]: {
                        timestamp: Date.now(),
                        value: draft,
                    },
                },
            },
        });

        const result = getDraft(state, currentChannelId);

        // Should only include file IDs with true values
        expect(result.spoilerFileIds).toHaveLength(2);
        expect(result.spoilerFileIds).toContain('file_id_1');
        expect(result.spoilerFileIds).toContain('file_id_3');
        expect(result.spoilerFileIds).not.toContain('file_id_2');
    });
});
