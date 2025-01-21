// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {makeMapStateToProps} from './index';

describe('mapStateToProps', () => {
    const mockedUser = TestHelper.getUserMock();
    const currentTeamId = 'team-id';
    const currentUserId = 'user-id';

    const initialState = {
        entities: {
            users: {
                currentUserId,
                profiles: {
                    mockedUser_1: {
                        ...mockedUser,
                        id: 'mockedUser_1',
                        remote_id: 'remote',
                    },
                    mockedUser_2: {
                        ...mockedUser,
                        id: 'mockedUser_2',
                        remote_id: 'remote',
                    },
                    mockedUser_3: {
                        ...mockedUser,
                        id: 'mockedUser_3',
                    },
                    mockedUser_4: {
                        ...mockedUser,
                        id: 'mockedUser_4',
                    },
                },
                profilesInTeam: {
                    [currentTeamId]: [
                        'mockedUser_1',
                        'mockedUser_2',
                        'mockedUser_3',
                        'mockedUser_4',
                    ],
                },
            },
            teams: {
                currentTeamId,
                teams: {
                    [currentTeamId]: {
                        id: currentTeamId,
                    },
                },
            },
            general: {
                config: {
                    FeatureFlagEnableSharedChannelsDMs: 'false',
                },
            },
        },
        views: {
            search: {
                modalSearch: '',
            },
        },
    } as unknown as GlobalState;

    test('should not include remote users', () => {
        const f = makeMapStateToProps();
        const props = f(initialState, {isExistingChannel: false});
        expect(props.users.length).toEqual(2);
    });

    test('should include remote users', () => {
        const testState = {
            ...initialState,
            entities: {
                ...initialState.entities,
                general: {
                    config: {
                        FeatureFlagEnableSharedChannelsDMs: 'true',
                    },
                },
            },
        } as unknown as GlobalState;
        const f = makeMapStateToProps();
        const props = f(testState, {isExistingChannel: false});
        expect(props.users.length).toEqual(4);
    });
});
