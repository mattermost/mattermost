// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';

import {createChannel} from 'mattermost-redux/actions/channels';
import Permissions from 'mattermost-redux/constants/permissions';

import {
    render,
    renderWithIntl,
    screen,
    userEvent,
    waitFor,
} from 'tests/react_testing_utils';

import {GlobalState} from 'types/store';

import {suitePluginIds} from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

import NewChannelModal from './new_channel_modal';

jest.mock('mattermost-redux/actions/channels');

const mockDispatch = jest.fn();
let mockState: GlobalState;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/new_channel_modal', () => {
    beforeEach(() => {
        mockState = {
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
                        current_channel_id: [
                            'channel_user',
                            'channel_admin',
                        ],
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
        } as unknown as GlobalState;
    });

    test('should match component state with given props', () => {
        render(<NewChannelModal/>);

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

        const purposeTextArea = screen.getByPlaceholderText('Enter a purpose for this channel (optional)');
        expect(purposeTextArea).toBeInTheDocument();
        expect(purposeTextArea).toHaveClass('new-channel-modal-purpose-textarea');

        const purposeDesc = screen.getByText('This will be displayed when browsing for channels.');
        expect(purposeDesc).toBeInTheDocument();

        const cancelButton = screen.getByText('Cancel');
        expect(cancelButton).toBeInTheDocument();
        expect(cancelButton).toHaveClass('GenericModal__button cancel');

        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeInTheDocument();
        expect(createChannelButton).toHaveClass('GenericModal__button confirm');
        expect(createChannelButton).toBeDisabled();
    });

    test('should handle display name change', () => {
        const value = 'Channel name';

        render(
            <NewChannelModal/>,
        );

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        userEvent.type(channelNameInput, value);

        // Display name should have been updated
        expect(channelNameInput).toHaveAttribute('value', value);

        // URL should have been changed according to display name
        const urlInputLabel = screen.getByTestId('urlInputLabel');
        expect(urlInputLabel).toHaveTextContent(cleanUpUrlable(value));
    });

    test('should handle url change', async () => {
        const value = 'Channel name';

        const url = 'channel-name-new';

        render(
            <NewChannelModal/>,
        );

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        userEvent.type(channelNameInput, value);
        const urlInputLabel = screen.getByTestId('urlInputLabel');
        expect(urlInputLabel).toHaveTextContent(cleanUpUrlable(value));

        // Change URL
        const editUrl = screen.getByText('Edit');
        expect(editUrl).toBeInTheDocument();

        userEvent.click(editUrl);

        const editUrlInput = screen.getByTestId('channelURLInput');
        userEvent.clear(editUrlInput);
        userEvent.type(editUrlInput, url);

        const doneButton = screen.getByText('Done');
        await waitFor(() =>
            userEvent.click(doneButton),
        );

        // URL should have been updated
        expect(screen.getByText(url, {exact: false})).toBeInTheDocument();

        // Change display name again
        userEvent.type(channelNameInput, `${value} updated`);

        // URL should NOT be updated
        expect(screen.getByText(url, {exact: false})).toBeInTheDocument();
    });

    test('should handle type changes', () => {
        render(
            <NewChannelModal/>,
        );

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        userEvent.click(privateChannel);

        // Type should have been updated to private
        expect(privateChannel.parentElement?.nextSibling?.firstChild).toHaveAttribute('aria-label', 'Check Circle Icon');

        // Change type to public
        const publicChannel = screen.getByText('Public Channel');
        expect(publicChannel).toBeInTheDocument();

        userEvent.click(publicChannel);

        // Type should have been updated to public
        expect(publicChannel.parentElement?.nextSibling?.firstChild).toHaveAttribute('aria-label', 'Check Circle Icon');
    });

    test('should handle purpose changes', () => {
        const value = 'Purpose';

        render(
            <NewChannelModal/>,
        );

        // Change purpose
        const ChannelPurposeTextArea = screen.getByPlaceholderText('Enter a purpose for this channel (optional)');
        expect(ChannelPurposeTextArea).toBeInTheDocument();

        userEvent.click(ChannelPurposeTextArea);
        userEvent.type(ChannelPurposeTextArea, value);

        // Purpose should have been updated
        expect(ChannelPurposeTextArea).toHaveValue(value);
    });

    test('should enable confirm button when having valid display name, url and type', () => {
        render(
            <NewChannelModal/>,
        );

        // Confirm button should be disabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeInTheDocument();
        expect(createChannelButton).toBeDisabled();

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        userEvent.type(channelNameInput, 'Channel name');

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        userEvent.click(privateChannel);

        // Confirm button should be enabled
        expect(createChannelButton).toBeEnabled();
    });

    test('should disable confirm button when display name in error', () => {
        render(
            <NewChannelModal/>,
        );

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        userEvent.type(channelNameInput, 'Channel name');

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        userEvent.click(privateChannel);

        // Confirm button should be enabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeEnabled();

        // Change display name to invalid
        userEvent.clear(channelNameInput);
        userEvent.type(channelNameInput, '');

        // Confirm button should be disabled
        expect(createChannelButton).toBeDisabled();
    });

    test('should disable confirm button when url in error', () => {
        render(
            <NewChannelModal/>,
        );

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        userEvent.type(channelNameInput, 'Channel name');

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        userEvent.click(privateChannel);

        // Confirm button should be enabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeEnabled();

        // Change url to invalid
        const editUrl = screen.getByText('Edit');
        expect(editUrl).toBeInTheDocument();

        userEvent.click(editUrl);

        const editUrlInput = screen.getByTestId('channelURLInput');
        userEvent.clear(editUrlInput);
        userEvent.type(editUrlInput, 'c-');

        // Confirm button should be disabled
        expect(createChannelButton).toBeDisabled();
    });

    test('should disable confirm button when server error', async () => {
        render(
            <NewChannelModal/>,
        );

        // Confirm button should be disabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeDisabled();

        // Change display name
        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        userEvent.type(channelNameInput, 'Channel name');

        // Change type to private
        const privateChannel = screen.getByText('Private Channel');
        expect(privateChannel).toBeInTheDocument();

        userEvent.click(privateChannel);

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

        renderWithIntl(
            <NewChannelModal/>,
        );

        // Confirm button should be disabled
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeDisabled();

        // Enter data

        const channelNameInput = screen.getByPlaceholderText('Enter a name for your new channel');
        expect(channelNameInput).toBeInTheDocument();
        expect(channelNameInput).toHaveAttribute('value', '');

        userEvent.type(channelNameInput, name);

        // Display name should be updated
        expect(channelNameInput).toHaveValue(name);

        // Confirm button should be enabled
        expect(createChannelButton).toBeEnabled();

        // Submit
        await act(async () => {
            userEvent.click(createChannelButton);
        });

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
