// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, within} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {TeamProfile} from './team_profile';

describe('admin_console/team_channel_settings/team/TeamProfile', () => {
    const baseProps = {
        team: TestHelper.getTeamMock(),
        name: 'name',
        description: '',
        onNameChange: jest.fn(),
        onDescriptionChange: jest.fn(),
        onToggleArchive: jest.fn(),
        isArchived: false,
    };

    const initialState = {
        views: {
            announcementBar: {
                announcementBarState: {
                    announcementBarCount: 1,
                },
            },
        },
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    Cloud: 'false',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin'},
                },
            },
        },
    };

    test('should match snapshot (not cloud, freemium disabled', () => {
        const {container} = renderWithContext(<TeamProfile {...baseProps}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with isArchived true', () => {
        const props = {
            ...baseProps,
            isArchived: true,
        };

        const {container} = renderWithContext(<TeamProfile {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });
});

describe('admin_console/team_channel_settings/team/TeamProfile editing', () => {
    const baseProps = {
        team: TestHelper.getTeamMock({display_name: 'Cyber Defense HQ', description: 'Original description'}),
        name: 'Cyber Defense HQ',
        description: 'Original description',
        onNameChange: jest.fn(),
        onDescriptionChange: jest.fn(),
        onToggleArchive: jest.fn(),
        isArchived: false,
    };

    const initialState = {
        entities: {
            general: {license: {IsLicensed: 'true', Cloud: 'false'}},
            users: {currentUserId: 'current_user_id', profiles: {current_user_id: {roles: 'system_admin'}}},
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders the team name and description as editable fields prefilled with the current values', () => {
        renderWithContext(<TeamProfile {...baseProps}/>, initialState);

        expect(screen.getByTestId('teamNameInput')).toHaveValue('Cyber Defense HQ');
        expect(screen.getByTestId('teamDescriptionInput')).toHaveValue('Original description');
    });

    test('calls onNameChange with the typed value when the team name is edited', async () => {
        const onNameChange = jest.fn();
        renderWithContext(
            <TeamProfile
                {...baseProps}
                onNameChange={onNameChange}
            />,
            initialState,
        );

        await userEvent.type(screen.getByTestId('teamNameInput'), '!');

        // The field is controlled by the name prop, so the change event reports the
        // current value with the appended character.
        expect(onNameChange).toHaveBeenCalledWith('Cyber Defense HQ!');
    });

    test('calls onDescriptionChange with the typed value when the description is edited', async () => {
        const onDescriptionChange = jest.fn();
        renderWithContext(
            <TeamProfile
                {...baseProps}
                onDescriptionChange={onDescriptionChange}
            />,
            initialState,
        );

        await userEvent.type(screen.getByTestId('teamDescriptionInput'), '.');

        expect(onDescriptionChange).toHaveBeenCalledWith('Original description.');
    });

    test('shows the validation error attached to the name field when nameError is provided', () => {
        const nameError = <span>{'Team name must be 2 or more characters'}</span>;
        renderWithContext(
            <TeamProfile
                {...baseProps}
                nameError={nameError}
            />,
            initialState,
        );

        // The error must render within the name field's container, not the description field's.
        const nameContainer = screen.getByTestId('teamNameInput').closest('.Input_container') as HTMLElement;
        expect(within(nameContainer).getByText('Team name must be 2 or more characters')).toBeInTheDocument();

        const descriptionContainer = screen.getByTestId('teamDescriptionInput').closest('.Input_container') as HTMLElement;
        expect(within(descriptionContainer).queryByText('Team name must be 2 or more characters')).not.toBeInTheDocument();
    });

    test('disables the name and description fields when isDisabled is set', () => {
        renderWithContext(
            <TeamProfile
                {...baseProps}
                isDisabled={true}
            />,
            initialState,
        );

        expect(screen.getByTestId('teamNameInput')).toBeDisabled();
        expect(screen.getByTestId('teamDescriptionInput')).toBeDisabled();
    });
});
