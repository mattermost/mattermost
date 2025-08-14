// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserPropertyRenderer from './userPropertyRenderer';

describe('UserPropertyRenderer', () => {
    const mockUser: UserProfile = TestHelper.getUserMock({
        id: 'user-id-123',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
    });

    const baseState = {
        entities: {
            users: {
                profiles: {
                    'user-id-123': mockUser,
                },
                profilesInChannel: {},
                profilesNotInChannel: {},
                profilesWithoutTeam: new Set(),
                profilesInTeam: {},
                profilesNotInTeam: {},
                statuses: {},
                myUserAccessTokens: {},
                stats: {},
                filteredStats: {},
            },
            general: {
                config: {},
                license: {},
            },
            preferences: {
                myPreferences: {},
            },
            teams: {
                currentTeamId: 'team-id',
                teams: {},
                myMembers: {},
                membersInTeam: {},
                stats: {},
            },
            channels: {
                currentChannelId: 'channel-id',
                channels: {},
                channelsInTeam: {},
                myMembers: {},
                stats: {},
                groupsAssociatedToChannel: {},
                totalCount: 0,
                manuallyUnread: {},
                channelModerations: {},
                channelMemberCountsByGroup: {},
            },
        },
    };

    const mockField: PropertyField = {
        id: 'field-id',
        name: 'Assignee',
        type: 'user',
        attrs: {},
    };

    const mockValue: PropertyValue<string> = {
        value: 'user-id-123',
    };

    describe('when field is not editable', () => {
        it('should render user avatar and profile component', () => {
            const field = {...mockField, attrs: {editable: false}};

            renderWithContext(
                <UserPropertyRenderer
                    field={field}
                    value={mockValue}
                />,
                baseState,
            );

            const userProperty = screen.getByTestId('user-property');
            expect(userProperty).toBeVisible();

            // Check that the user profile component is rendered
            const userProfile = screen.getByText('testuser');
            expect(userProfile).toBeVisible();
        });

        it('should render when user is not loaded yet', () => {
            const stateWithoutUser = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    users: {
                        ...baseState.entities.users,
                        profiles: {},
                    },
                },
            };

            renderWithContext(
                <UserPropertyRenderer
                    field={mockField}
                    value={mockValue}
                />,
                stateWithoutUser,
            );

            const userProperty = screen.getByTestId('user-property');
            expect(userProperty).toBeVisible();
        });

        it('should handle empty user id', () => {
            const emptyValue: PropertyValue<string> = {
                value: '',
            };

            renderWithContext(
                <UserPropertyRenderer
                    field={mockField}
                    value={emptyValue}
                />,
                baseState,
            );

            const userProperty = screen.getByTestId('user-property');
            expect(userProperty).toBeVisible();
        });
    });

    describe('when field is editable', () => {
        it('should render selectable user property renderer', () => {
            const editableField = {...mockField, attrs: {editable: true}};

            renderWithContext(
                <UserPropertyRenderer
                    field={editableField}
                    value={mockValue}
                />,
                baseState,
            );

            const selectableUserProperty = screen.getByTestId('selectable-user-property');
            expect(selectableUserProperty).toBeVisible();

            // Check that the placeholder is visible
            const placeholder = screen.getByText('Unassigned');
            expect(placeholder).toBeVisible();
        });

        it('should pass correct field id to selectable renderer', () => {
            const editableField = {...mockField, attrs: {editable: true}};

            renderWithContext(
                <UserPropertyRenderer
                    field={editableField}
                    value={mockValue}
                />,
                baseState,
            );

            // Check that the UserSelector has the correct id
            const userSelector = screen.getByRole('combobox');
            expect(userSelector).toHaveAttribute('id', `selectable-user-property-renderer-${mockField.id}`);
        });
    });

    describe('user loading behavior', () => {
        it('should dispatch getMissingProfilesByIds when user is not loaded', () => {
            const stateWithoutUser = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    users: {
                        ...baseState.entities.users,
                        profiles: {},
                    },
                },
            };

            const {store} = renderWithContext(
                <UserPropertyRenderer
                    field={mockField}
                    value={mockValue}
                />,
                stateWithoutUser,
            );

            // Check that the action was dispatched
            const actions = store.getActions();
            expect(actions).toContainEqual(
                expect.objectContaining({
                    type: 'USERS_REQUEST',
                }),
            );
        });

        it('should not dispatch when user is already loaded', () => {
            const {store} = renderWithContext(
                <UserPropertyRenderer
                    field={mockField}
                    value={mockValue}
                />,
                baseState,
            );

            // Should not dispatch any user loading actions since user is already loaded
            const actions = store.getActions();
            const userRequestActions = actions.filter(action => action.type === 'USERS_REQUEST');
            expect(userRequestActions).toHaveLength(0);
        });

        it('should not dispatch when userId is empty', () => {
            const emptyValue: PropertyValue<string> = {
                value: '',
            };

            const {store} = renderWithContext(
                <UserPropertyRenderer
                    field={mockField}
                    value={emptyValue}
                />,
                baseState,
            );

            const actions = store.getActions();
            const userRequestActions = actions.filter(action => action.type === 'USERS_REQUEST');
            expect(userRequestActions).toHaveLength(0);
        });
    });
});
