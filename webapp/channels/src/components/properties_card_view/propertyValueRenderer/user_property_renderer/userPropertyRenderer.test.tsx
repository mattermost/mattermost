// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import UserPropertyRenderer from './userPropertyRenderer';

describe('UserPropertyRenderer', () => {
    const mockUser: UserProfile = TestHelper.getUserMock({
        id: 'user-id-123',
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
    });

    const baseState: DeepPartial<GlobalState> = {
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

    const mockField = {
        id: 'field-id',
        name: 'Assignee',
        type: 'user',
        attrs: {},
    } as PropertyField;

    const mockValue = {
        value: 'user-id-123',
    } as PropertyValue<string>;

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
            expect(userProperty).toBeInTheDocument();

            // Check that the user profile component is rendered with the username
            const userProfile = screen.getByText('testuser');
            expect(userProfile).toBeInTheDocument();
            
            // Check that the avatar component is present
            const avatar = userProperty.querySelector('.PreviewPostAvatar');
            expect(avatar).toBeInTheDocument();
        });

        it('should render when user is not loaded yet', () => {
            const stateWithoutUser = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    users: {
                        ...baseState.entities!.users,
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
            expect(userProperty).toBeInTheDocument();
            
            // Should still render the container even without user data
            expect(userProperty.children).toHaveLength(2); // Avatar and UserProfile components
        });

        it('should handle empty user id', () => {
            const emptyValue = {
                value: '',
            } as PropertyValue<string>;

            renderWithContext(
                <UserPropertyRenderer
                    field={mockField}
                    value={emptyValue}
                />,
                baseState,
            );

            const userProperty = screen.getByTestId('user-property');
            expect(userProperty).toBeInTheDocument();
            
            // Should render components even with empty user id
            expect(userProperty.children).toHaveLength(2); // Avatar and UserProfile components
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
            expect(selectableUserProperty).toBeInTheDocument();

            // Check that the placeholder text is present
            const placeholder = screen.getByText('Unassigned');
            expect(placeholder).toBeInTheDocument();
            
            // Check that the UserSelector component is rendered
            const userSelector = screen.getByRole('combobox');
            expect(userSelector).toBeInTheDocument();
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

            // Check that the UserSelector has the correct id attribute
            const userSelector = screen.getByRole('combobox');
            expect(userSelector).toHaveAttribute('id', `selectable-user-property-renderer-${mockField.id}_input`);
            expect(userSelector).toBeInTheDocument();
        });
    });
});
