// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import TeamMembersDropdown from 'components/team_members_dropdown/team_members_dropdown';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/team_members_dropdown', () => {
    const baseState = {
        entities: {
            users: {
                currentUserId: 'user-1',
            },
            general: {
                config: {},
            },
        },
    };
    const user = TestHelper.getUserMock({id: 'user-1', username: 'username1', roles: 'team_admin', is_bot: false});

    const user2 = TestHelper.getUserMock({id: 'user-2', username: 'username2', roles: 'team_admin', is_bot: false});

    const bot = TestHelper.getUserMock({id: 'bot-user', username: 'bot', roles: 'system_user', is_bot: true});

    const team = TestHelper.getTeamMock({type: 'O', allowed_domains: '', allow_open_invite: false, scheme_id: undefined});

    const baseProps = {
        user: user2,
        currentUser: user,
        teamMember: TestHelper.getTeamMembershipMock({roles: 'channel_admin', scheme_admin: true}),
        teamUrl: '',
        currentTeam: team,
        index: 0,
        totalUsers: 10,
        collapsedThreads: true,
        actions: {
            getMyTeamMembers: vi.fn(),
            getMyTeamUnreads: vi.fn(),
            getUser: vi.fn(),
            getTeamMember: vi.fn(),
            getTeamStats: vi.fn(),
            getChannelStats: vi.fn(),
            updateTeamMemberSchemeRoles: vi.fn(),
            removeUserFromTeamAndGetStats: vi.fn(),
            updateUserActive: vi.fn(),
        },
    };

    test('should match snapshot for team_members_dropdown', () => {
        const {container} = renderWithContext(
            <TeamMembersDropdown {...baseProps}/>,
            baseState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot opening dropdown upwards', () => {
        const {container} = renderWithContext(
            <TeamMembersDropdown
                {...baseProps}
                index={4}
                totalUsers={5}
            />,
            baseState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with group-constrained team', () => {
        const propsWithGroupConstrained = {
            ...baseProps,
            currentTeam: {...team, group_constrained: true},
        };
        const {container} = renderWithContext(
            <TeamMembersDropdown {...propsWithGroupConstrained}/>,
            baseState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for a bot with group-constrained team', () => {
        const propsWithBot = {
            ...baseProps,
            currentTeam: {...team, group_constrained: true},
            user: bot,
        };
        const {container} = renderWithContext(
            <TeamMembersDropdown {...propsWithBot}/>,
            baseState,
        );
        expect(container).toMatchSnapshot();
    });
});
