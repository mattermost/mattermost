// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserList from './user_list';

describe('components/UserList', () => {
    const baseState = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
                profiles: {},
            },
            teams: {
                currentTeamId: 'team_id',
                teams: {},
                membersInTeam: {},
            },
            general: {
                config: {},
            },
        },
    };

    test('should match default snapshot', () => {
        const props = {
            actionProps: {
                mfaEnabled: false,
                enableUserAccessTokens: false,
                experimentalEnableAuthenticationTransfer: false,
                doPasswordReset: vi.fn(),
                doEmailReset: vi.fn(),
                doManageTeams: vi.fn(),
                doManageRoles: vi.fn(),
                doManageTokens: vi.fn(),
                isDisabled: false,
            },
        };
        const {container} = renderWithContext(
            <UserList {...props}/>,
            baseState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match default snapshot when there are users', () => {
        const User1 = TestHelper.getUserMock({id: 'id1'});
        const User2 = TestHelper.getUserMock({id: 'id2'});
        const props = {
            users: [
                User1,
                User2,
            ],
            actionUserProps: {},
            actionProps: {
                mfaEnabled: false,
                enableUserAccessTokens: false,
                experimentalEnableAuthenticationTransfer: false,
                doPasswordReset: vi.fn(),
                doEmailReset: vi.fn(),
                doManageTeams: vi.fn(),
                doManageRoles: vi.fn(),
                doManageTokens: vi.fn(),
                isDisabled: false,
            },
        };

        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                users: {
                    ...baseState.entities.users,
                    profiles: {
                        id1: User1,
                        id2: User2,
                    },
                },
            },
        };

        const {container} = renderWithContext(
            <UserList {...props}/>,
            state,
        );
        expect(container).toMatchSnapshot();
    });
});
