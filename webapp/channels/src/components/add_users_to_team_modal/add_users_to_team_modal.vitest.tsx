// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi, beforeEach, afterEach} from 'vitest';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, cleanup, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AddUsersToTeamModal from './add_users_to_team_modal';

describe('components/admin_console/add_users_to_team_modal/AddUsersToTeamModal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(async () => {
        await act(async () => {
            vi.runAllTimers();
        });
        vi.useRealTimers();
        cleanup();
    });

    function createUser(id: string, username: string, bot: boolean): UserProfile {
        return TestHelper.getUserMock({
            id,
            username,
            is_bot: bot,
        });
    }

    const user1 = createUser('userid1', 'user-1', false);
    const user2 = createUser('userid2', 'user-2', false);
    const removedUser = createUser('userid-not-removed', 'user-not-removed', false);
    const team: Team = TestHelper.getTeamMock({
        id: 'team-1',
        create_at: 1589222794545,
        update_at: 1589222794545,
        delete_at: 0,
        display_name: 'test-team',
        name: 'test-team',
        description: '',
        email: '',
        type: 'O',
        company_name: '',
        allowed_domains: '',
        invite_id: '',
        allow_open_invite: true,
        scheme_id: '',
        group_constrained: false,
    });

    const baseProps = {
        team,
        users: [user1, user2],

        excludeUsers: {},
        includeUsers: {},

        onAddCallback: vi.fn(),
        onExited: vi.fn(),

        actions: {
            getProfilesNotInTeam: vi.fn().mockResolvedValue({data: []}),
            searchProfiles: vi.fn().mockResolvedValue({data: []}),
        },
    };

    test('should match snapshot with 2 users', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUsersToTeamModal
                    {...baseProps}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });
        expect(container!).toMatchSnapshot();
    });

    test('should match snapshot with 2 users, 1 included and 1 removed', async () => {
        let container: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <AddUsersToTeamModal
                    {...baseProps}
                    includeUsers={{[removedUser.id]: removedUser}}
                    excludeUsers={{[user1.id]: user1}}
                />,
            );
            container = result.container;
            vi.runAllTimers();
        });
        expect(container!).toMatchSnapshot();
    });
});
