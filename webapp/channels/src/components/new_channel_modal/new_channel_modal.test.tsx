// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {createChannel} from 'mattermost-redux/actions/channels';
import Permissions from 'mattermost-redux/constants/permissions';

import {
    act,
    renderWithContext,
    screen,
    userEvent,
    waitFor,
    fireEvent,
} from 'tests/react_testing_utils';
import {suitePluginIds} from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

import type {GlobalState} from 'types/store';

import NewChannelModal from './new_channel_modal';

jest.mock('mattermost-redux/actions/channels');

describe('components/new_channel_modal', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {},
            },
            channels: {
                currentChannelId: 'current_channel_id',
                channels: {
                    current_channel_id: {
                        id: 'current_channel_id',
                        display_name: 'Current channel',
                        name: 'current_channel',
                    },
                },
                roles: {
                    current_channel_id: new Set([
                        'channel_user',
                        'channel_admin',
                    ]),
                },
            },
            teams: {
                currentTeamId: 'current_team_id',
                myMembers: {
                    current_team_id: {
                        roles: 'team_user team_admin',
                    },
                },
                teams: {
                    current_team_id: {
                        id: 'current_team_id',
                        description: 'Curent team description',
                        name: 'current-team',
                    },
                },
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin system_user'},
                },
            },
            roles: {
                roles: {
                    channel_admin: {
                        permissions: [],
                    },
                    channel_user: {
                        permissions: [],
                    },
                    team_admin: {
                        permissions: [],
                    },
                    team_user: {
                        permissions: [
                            Permissions.CREATE_PRIVATE_CHANNEL,
                        ],
                    },
                    system_admin: {
                        permissions: [
                            Permissions.CREATE_PUBLIC_CHANNEL,
                        ],
                    },
                    system_user: {
                        permissions: [],
                    },
                },
            },
        },
        plugins: {
            plugins: {focalboard: {id: suitePluginIds.focalboard}},
        },
    };

    test('should match component state with given props', () => {
        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        const heading = screen.getByRole('heading');
        expect(heading).toBeInTheDocument();
        expect(heading).toHaveAttribute('id', 'genericModalLabel');
        expect(heading.parentElement).toHaveClass('GenericModal__header');
        expect(heading).toHaveTextContent('Create a new channel');

        const channelNameHeading = screen.getByText('Channel name');
        expect(channelNameHeading).toBeInTheDocument();
        expect(channelNameHeading).toHaveClass('Input_legend Input_legend___focus');

        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');
        expect(channelNameInput).toHaveAttribute('type', 'text');
        expect(channelNameInput).toHaveAttribute('name', 'new-channel-modal-name');
        expect(channelNameInput).toHaveAttribute('id', 'input_new-channel-modal-name');
        expect(channelNameInput).toHaveClass('Input form-control medium new-channel-modal-name-input Input__focus');

        const editUrl = screen.getByText('Edit');
        expect(editUrl).toBeInTheDocument();
        expect(editUrl).toHaveClass('url-input-button-label');
        expect(editUrl.parentElement).toHaveClass('url-input-button');

        const publicChannelSvg = screen.getByLabelText('Globe Circle Solid Icon');
        expect(publicChannelSvg).toBeInTheDocument();

        const publicChannelHeading = screen.getByText('Public Channel');
        expect(publicChannelHeading).toBeInTheDocument();
        expect(publicChannelHeading.nextSibling).toHaveTextContent('Anyone can join');

        const privateChannelSvg = screen.getByLabelText('Lock Circle Solid Icon');
        expect(privateChannelSvg).toBeInTheDocument();

        const privateChannelHeading = screen.getByText('Private Channel');
        expect(privateChannelHeading).toBeInTheDocument();
        expect(privateChannelHeading.nextSibling).toHaveTextContent('Only invited members');

        const purposeTextArea = screen.getByLabelText('Channel Purpose');
        expect(purposeTextArea).toBeInTheDocument();
        expect(purposeTextArea).toHaveClass('Input form-control medium');

        const purposeDesc = screen.getByText('This will be displayed when browsing for channels.');
        expect(purposeDesc).toBeInTheDocument();

        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toBeInTheDocument();
        expect(cancelButton).toHaveClass('btn-tertiary');

        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeInTheDocument();
        expect(createChannelButton).toHaveClass('btn-primary');
        expect(createChannelButton).toBeDisabled();
    });

    test('should handle display name change', async () => {
        const value = 'Channel name';

        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        await userEvent.type(channelNameInput, value);

        // Display name should have been updated
        expect(channelNameInput).toHaveAttribute('value', value);

        // URL should have been changed according to display name
        const urlInputLabel = screen.getByTestId('urlInputLabel');
        expect(urlInputLabel).toHaveTextContent(cleanUpUrlable(value));
    });

    test('should handle url change', async () => {
        const value = 'Channel name';

        const url = 'channel-name-new';

        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        await userEvent.type(channelNameInput, value);
        const urlInputLabel = screen.getByTestId('urlInputLabel');
        expect(urlInputLabel).toHaveTextContent(cleanUpUrlable(value));

        // Change URL
        const editUrl = screen.getByText('Edit');
        expect(editUrl).toBeInTheDocument();

        await userEvent.click(editUrl);

        const editUrlInput = screen.getByTestId('channelURLInput');
        await userEvent.clear(editUrlInput);
        await userEvent.type(editUrlInput, url);

        // Tab out of the input since it saves on blur
        await userEvent.tab();

        // URL should have been updated
        await waitFor(() => {
            expect(screen.queryByText(url, {exact: false})).toBeInTheDocument();
        });

        // Change display name again
        await userEvent.type(channelNameInput, `${value} updated`);

        // URL should NOT be updated
        expect(screen.getByText(url, {exact: false})).toBeInTheDocument();
    });

    test('should handle type changes', async () => {
        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        await userEvent.click(privateChannel);

        // Type should have been updated to private
        expect(privateChannel.parentElement?.nextSibling?.firstChild).toHaveAttribute('aria-label', 'Check Circle Icon');

        // Change type to public
        const publicChannel = screen.getByText('Public Channel');
        expect(publicChannel).toBeInTheDocument();

        await userEvent.click(publicChannel);

        // Type should have been updated to public
        expect(publicChannel.parentElement?.nextSibling?.firstChild).toHaveAttribute('aria-label', 'Check Circle Icon');
    });

    test('should handle purpose changes', async () => {
        const value = 'Purpose';

        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Change purpose
        const ChannelPurposeTextArea = screen.getByLabelText('Channel Purpose');
        expect(ChannelPurposeTextArea).toBeInTheDocument();

        await act(async () => {
            fireEvent.focus(ChannelPurposeTextArea);
            fireEvent.change(ChannelPurposeTextArea, {target: {value}});
            fireEvent.blur(ChannelPurposeTextArea);
        });

        // Purpose should have been updated
        expect(ChannelPurposeTextArea).toHaveValue(value);
    });

    test('should enable confirm button when having valid display name, url and type', async () => {
        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Confirm button should be disabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeInTheDocument();
        expect(createChannelButton).toBeDisabled();

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        await userEvent.type(channelNameInput, 'Channel name');

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        await userEvent.click(privateChannel);

        // Confirm button should be enabled
        expect(createChannelButton).toBeEnabled();
    });

    test('should disable confirm button when display name in error', async () => {
        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        await userEvent.type(channelNameInput, 'Channel name');

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        await userEvent.click(privateChannel);

        // Confirm button should be enabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeEnabled();

        // Change display name to invalid
        await userEvent.clear(channelNameInput);

        // Confirm button should be disabled
        expect(createChannelButton).toBeDisabled();
    });

    test('should disable confirm button when url in error', async () => {
        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        await userEvent.type(channelNameInput, 'Channel name');

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        await userEvent.click(privateChannel);

        // Confirm button should be enabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeEnabled();

        // Change url to invalid
        const editUrl = screen.getByText('Edit');
        expect(editUrl).toBeInTheDocument();

        await userEvent.click(editUrl);

        const editUrlInput = screen.getByTestId('channelURLInput');
        await userEvent.clear(editUrlInput);
        await userEvent.type(editUrlInput, 'c-');

        // Confirm button should be disabled
        expect(createChannelButton).toBeDisabled();
    });

    test('should disable confirm button when server error', async () => {
        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Confirm button should be disabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeDisabled();

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        await userEvent.type(channelNameInput, 'Channel name');

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        await userEvent.click(privateChannel);

        // Confirm button should be enabled
        expect(createChannelButton).toBeEnabled();

        // Submit
        await act(async () => userEvent.click(createChannelButton));

        const serverError = screen.getByText('Something went wrong. Please try again.');
        expect(serverError).toBeInTheDocument();
        expect(createChannelButton).toBeDisabled();
    });

    test('should request team creation on submit', async () => {
        const name = 'Channel name';

        renderWithContext(
            <NewChannelModal/>,
            initialState,
        );

        // Confirm button should be disabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeDisabled();

        // Enter data

        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        await userEvent.type(channelNameInput, name);

        // Display name should be updated
        expect(channelNameInput).toHaveValue(name);

        // Confirm button should be enabled
        expect(createChannelButton).toBeEnabled();

        // Submit
        await userEvent.click(createChannelButton);

        // Request should be sent
        expect(createChannel).toHaveBeenCalledWith({
            create_at: 0,
            creator_id: '',
            delete_at: 0,
            display_name: name,
            group_constrained: false,
            header: '',
            id: '',
            last_post_at: 0,
            last_root_post_at: 0,
            name: 'channel-name',
            purpose: '',
            scheme_id: '',
            team_id: 'current_team_id',
            type: 'O',
            update_at: 0,
        }, '');
    });
});
