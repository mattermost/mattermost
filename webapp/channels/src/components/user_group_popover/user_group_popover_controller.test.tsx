// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as userActions from 'mattermost-redux/actions/users';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {UserGroupPopoverController} from './user_group_popover_controller';

jest.mock('mattermost-redux/actions/users', () => ({
    ...jest.requireActual('mattermost-redux/actions/users'),
    getProfilesInGroup: jest.fn(() => () => ({type: 'MOCK_GET_PROFILES_IN_GROUP'})),
}));

describe('UserGroupPopoverController', () => {
    const group = TestHelper.getGroupMock({
        id: 'group1',
        name: 'test-group',
        display_name: 'Test Group',
        member_count: 5,
    });

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team_id1',
                teams: {
                    team_id1: {
                        id: 'team_id1',
                        name: 'team1',
                    },
                },
            },
            general: {
                config: {},
            },
            users: {
                profiles: {},
                profilesInGroup: {},
                statuses: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
        views: {
            modals: {
                modalState: {},
            },
            search: {
                popoverSearch: '',
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should fetch group members when popover opens on click', async () => {
        renderWithContext(
            <UserGroupPopoverController
                group={group}
                returnFocus={jest.fn()}
            >
                <span>{'@test-group'}</span>
            </UserGroupPopoverController>,
            initialState as any,
        );

        await userEvent.click(screen.getByText('@test-group'));

        expect(userActions.getProfilesInGroup).toHaveBeenCalledWith(
            'group1',
            0,
            100,
            'display_name',
        );
    });

    test('should not fetch additional group members when popover closes', async () => {
        renderWithContext(
            <UserGroupPopoverController
                group={group}
                returnFocus={jest.fn()}
            >
                <span>{'@test-group'}</span>
            </UserGroupPopoverController>,
            initialState as any,
        );

        await userEvent.click(screen.getByText('@test-group'));

        const callCountAfterOpen = (userActions.getProfilesInGroup as jest.Mock).mock.calls.length;
        expect(callCountAfterOpen).toBeGreaterThanOrEqual(1);

        // Close by pressing Escape
        await userEvent.keyboard('{Escape}');

        expect(userActions.getProfilesInGroup).toHaveBeenCalledTimes(callCountAfterOpen);
    });
});
