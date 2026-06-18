// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
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
import {ModalIdentifiers, suitePluginIds} from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';

import type {GlobalState} from 'types/store';

import NewChannelModal from './new_channel_modal';

jest.mock('actions/views/channel', () => ({
    switchToChannel: jest.fn((channel) => ({type: 'SWITCH_TO_CHANNEL', channel})),
}));

jest.mock('actions/views/modals', () => ({
    closeModal: jest.fn((id) => ({type: 'CLOSE_MODAL', modalId: id})),
    openModal: jest.fn(() => ({type: 'OPEN_MODAL'})),
}));

jest.mock('plugins/pluggable', () => ({
    __esModule: true,
    default: ({pluggableName}: {pluggableName: string}) => <div data-testid={`pluggable-${pluggableName}`}/>,
}));

jest.mock('mattermost-redux/actions/channels');

describe('components/new_channel_modal', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    UseAnonymousURLs: 'false',
                },
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
                        permissions: [Permissions.CREATE_PRIVATE_CHANNEL],
                    },
                    system_admin: {
                        permissions: [Permissions.CREATE_PUBLIC_CHANNEL],
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

        // Simulate user interaction with purpose field including focus/blur for validation - fireEvent used because userEvent doesn't have direct focus/blur methods
        await act(async () => {
            fireEvent.focus(ChannelPurposeTextArea);
            await userEvent.clear(ChannelPurposeTextArea);
            await userEvent.type(ChannelPurposeTextArea, value);
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
        // Mock createChannel to return an error
        (createChannel as jest.Mock).mockReturnValue(() => Promise.resolve({error: {message: 'Something went wrong. Please try again.'}}));

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
        await userEvent.click(createChannelButton);

        // Wait for async state updates
        await waitFor(() => {
            const serverError = screen.getByText('Something went wrong. Please try again.');
            expect(serverError).toBeInTheDocument();
        });
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

describe('components/new_channel_modal - plugin channel-type options', () => {
    const {switchToChannel} = require('actions/views/channel');
    const {closeModal} = require('actions/views/modals');

    const baseState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                config: {
                    UseAnonymousURLs: 'false',
                },
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
                    current_channel_id: new Set(['channel_user', 'channel_admin']),
                },
            },
            teams: {
                currentTeamId: 'current_team_id',
                myMembers: {
                    current_team_id: {roles: 'team_user team_admin'},
                },
                teams: {
                    current_team_id: {
                        id: 'current_team_id',
                        description: 'Current team description',
                        name: 'current-team',
                    },
                },
            },
            preferences: {myPreferences: {}},
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin system_user'},
                },
            },
            roles: {
                roles: {
                    channel_admin: {permissions: []},
                    channel_user: {permissions: []},
                    team_admin: {permissions: []},
                    team_user: {permissions: [Permissions.CREATE_PRIVATE_CHANNEL]},
                    system_admin: {permissions: [Permissions.CREATE_PUBLIC_CHANNEL]},
                    system_user: {permissions: []},
                },
            },
        },
        plugins: {
            plugins: {focalboard: {id: suitePluginIds.focalboard}},
        },
    };

    const mockChannel: Channel = {
        id: 'new_channel_id',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        team_id: 'current_team_id',
        type: 'O',
        display_name: 'My Channel',
        name: 'my-channel',
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        creator_id: '',
        scheme_id: '',
        group_constrained: false,
    };

    function stateWithOption(overrides: {isAvailable?: () => boolean; onCreate?: jest.Mock; extraContent?: React.ComponentType<any>; createButtonText?: React.ReactNode} = {}): DeepPartial<GlobalState> {
        const {
            isAvailable = () => true,
            onCreate = jest.fn().mockResolvedValue({status: 'created', channel: mockChannel}),
            extraContent,
            createButtonText,
        } = overrides;

        return {
            ...baseState,
            plugins: {
                ...baseState.plugins,
                components: {
                    ChannelTypeOption: [
                        {
                            id: 'plugin-option',
                            pluginId: 'test-plugin',
                            label: 'Plugin Channel',
                            description: 'A plugin channel type',
                            icon: <i data-testid='plugin-icon'/>,
                            isAvailable,
                            onCreate,
                            extraContent,
                            createButtonText,
                        },
                    ],
                },
            },
        } as DeepPartial<GlobalState>;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (createChannel as jest.Mock).mockReturnValue(() => Promise.resolve({data: mockChannel, error: null}));
    });

    test('plugin channel-type option rendering - three buttons with available option', async () => {
        renderWithContext(<NewChannelModal/>, stateWithOption());

        expect(screen.getByText('Public Channel')).toBeInTheDocument();
        expect(screen.getByText('Private Channel')).toBeInTheDocument();
        expect(screen.getByText('Plugin Channel')).toBeInTheDocument();
        expect(screen.queryAllByRole('button').filter((b) => b.classList.contains('public-private-selector-button'))).toHaveLength(3);
    });

    test('selecting plugin button updates selected state', async () => {
        renderWithContext(<NewChannelModal/>, stateWithOption());

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        expect(pluginButton.closest('button')).toHaveClass('selected');
    });

    test('confirm button label - falls back to "Create channel" when the selected option supplies no createButtonText', async () => {
        renderWithContext(<NewChannelModal/>, stateWithOption());

        await userEvent.click(screen.getByText('Plugin Channel'));

        expect(screen.getByRole('button', {name: /create channel/i})).toBeInTheDocument();
    });

    test('confirm button label - uses the selected option createButtonText when supplied', async () => {
        renderWithContext(<NewChannelModal/>, stateWithOption({createButtonText: 'Next'}));

        // Before selecting the plugin option, the default built-in label is shown.
        expect(screen.getByRole('button', {name: /create channel/i})).toBeInTheDocument();

        await userEvent.click(screen.getByText('Plugin Channel'));

        expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: /create channel/i})).not.toBeInTheDocument();
    });

    test('isAvailable gating - unavailable option renders only Public and Private', () => {
        renderWithContext(<NewChannelModal/>, stateWithOption({isAvailable: () => false}));

        expect(screen.getByText('Public Channel')).toBeInTheDocument();
        expect(screen.getByText('Private Channel')).toBeInTheDocument();
        expect(screen.queryByText('Plugin Channel')).not.toBeInTheDocument();
        expect(screen.queryAllByRole('button').filter((b) => b.classList.contains('public-private-selector-button'))).toHaveLength(2);
    });

    test('isAvailable throw - option dropped, modal renders, error logged', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        renderWithContext(<NewChannelModal/>, stateWithOption({isAvailable: () => {
            throw new Error('boom');
        }}));

        expect(screen.getByText('Public Channel')).toBeInTheDocument();
        expect(screen.getByText('Private Channel')).toBeInTheDocument();
        expect(screen.queryByText('Plugin Channel')).not.toBeInTheDocument();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('test-plugin:plugin-option'),
            expect.any(Error),
        );
        consoleSpy.mockRestore();
    });

    test('CreateResult: created - modal closes and switchToChannel dispatched', async () => {
        const onCreate = jest.fn().mockResolvedValue({status: 'created', channel: mockChannel});
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(onCreate).toHaveBeenCalledTimes(1);
            expect(switchToChannel).toHaveBeenCalledWith(mockChannel);
            expect(closeModal).toHaveBeenCalledWith(ModalIdentifiers.NEW_CHANNEL_MODAL);
        });
        expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
            teamId: 'current_team_id',
            displayName: 'My Channel',
            url: 'my-channel',
            purpose: '',
            type: 'plugin-option',
            managedCategoryName: undefined,
        }));
        expect(createChannel).not.toHaveBeenCalled();
    });

    test('CreateResult: deferred - modal closes without dispatching switchToChannel', async () => {
        const onCreate = jest.fn().mockResolvedValue({status: 'deferred'});
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(onCreate).toHaveBeenCalledTimes(1);
            expect(closeModal).toHaveBeenCalledWith(ModalIdentifiers.NEW_CHANNEL_MODAL);
        });
        expect(switchToChannel).not.toHaveBeenCalled();
    });

    test('CreateResult: error - modal stays open and error message shown', async () => {
        const onCreate = jest.fn().mockResolvedValue({status: 'error', message: 'rejected'});
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText('rejected')).toBeInTheDocument();
        });
        expect(screen.getByText('Plugin Channel')).toBeInTheDocument();
        expect(switchToChannel).not.toHaveBeenCalled();
        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
    });

    test('onCreate throws - modal stays open with generic error', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const onCreate = jest.fn().mockRejectedValue(new Error('network failure'));
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
        expect(screen.getByText('Plugin Channel')).toBeInTheDocument();
        expect(switchToChannel).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('test-plugin:plugin-option'),
            expect.anything(),
        );
        consoleSpy.mockRestore();
    });

    test('extraContent rendering - extra content shown when plugin option selected, absent for Public', async () => {
        const ExtraContent = () => (
            <input
                data-testid='extra-content-input'
                placeholder='extra field'
            />
        );
        renderWithContext(<NewChannelModal/>, stateWithOption({extraContent: ExtraContent}));

        expect(screen.queryByTestId('extra-content-input')).not.toBeInTheDocument();

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        expect(screen.getByTestId('extra-content-input')).toBeInTheDocument();

        const publicButton = screen.getByText('Public Channel');
        await userEvent.click(publicButton);

        expect(screen.queryByTestId('extra-content-input')).not.toBeInTheDocument();
    });

    test('setCanCreate(false) from extraContent disables Create button', async () => {
        const ExtraContent = ({setCanCreate}: {setCanCreate: (v: boolean) => void}) => {
            React.useEffect(() => {
                setCanCreate(false);
            }, [setCanCreate]);
            return <div data-testid='extra-blocker'/>;
        };
        renderWithContext(<NewChannelModal/>, stateWithOption({extraContent: ExtraContent}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        await waitFor(() => {
            const createButton = screen.getByRole('button', {name: /create channel/i});
            expect(createButton).toBeDisabled();
        });
    });

    test('pending submit state - Create button disabled and pending indicator shown', async () => {
        let resolveOnCreate!: (value: any) => void;
        const onCreate = jest.fn().mockReturnValue(
            new Promise((resolve) => {
                resolveOnCreate = resolve;
            }),
        );
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByTestId('loadingSpinner')).toBeInTheDocument();
            expect(createButton).toBeDisabled();
        });

        await act(async () => {
            resolveOnCreate({status: 'deferred'});
        });
    });

    test('stale unavailable selection - Create is disabled and plugin onCreate not called', async () => {
        const onCreate = jest.fn().mockResolvedValue({status: 'created', channel: mockChannel});
        const {store} = renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        // Remove the plugin's option from Redux state (the plugin unloaded mid-flow).
        // This exercises the real useSelector path rather than a rerender closure mutation.
        await act(async () => {
            store.dispatch({
                type: 'REMOVED_WEBAPP_PLUGIN',
                data: {id: 'test-plugin'},
            });
        });

        await waitFor(() => {
            expect(screen.queryByText('Plugin Channel')).not.toBeInTheDocument();
        });

        const createButton = screen.getByRole('button', {name: /create channel/i});
        expect(createButton).toBeDisabled();
        expect(onCreate).not.toHaveBeenCalled();
    });

    test('built-in path regression - selecting Private and clicking Create dispatches createChannel', async () => {
        renderWithContext(<NewChannelModal/>, stateWithOption());

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const privateButton = screen.getByText('Private Channel');
        await userEvent.click(privateButton);

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(createChannel).toHaveBeenCalledWith(
                expect.objectContaining({type: 'P', display_name: 'My Channel'}),
                '',
            );
        });
    });

    test('CreateBoardFromTemplate Pluggable hidden when plugin option is selected', async () => {
        const stateWithBoard: DeepPartial<GlobalState> = {
            ...stateWithOption(),
            plugins: {
                ...(stateWithOption() as any).plugins,
                components: {
                    ...(stateWithOption() as any).plugins.components,
                    CreateBoardFromTemplate: [
                        {
                            id: 'board-plugin',
                            pluginId: suitePluginIds.focalboard,
                            component: () => <div data-testid='board-template'/>,
                            action: jest.fn(),
                        },
                    ],
                },
            },
        };

        renderWithContext(<NewChannelModal/>, stateWithBoard);

        expect(screen.getByTestId('pluggable-CreateBoardFromTemplate')).toBeInTheDocument();

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        expect(screen.queryByTestId('pluggable-CreateBoardFromTemplate')).not.toBeInTheDocument();
    });

    test('isSubmitting is cleared after error so a second submit fires onCreate again', async () => {
        const onCreate = jest.fn().
            mockResolvedValueOnce({status: 'error', message: 'first try failed'}).
            mockResolvedValueOnce({status: 'created', channel: mockChannel});
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText('first try failed')).toBeInTheDocument();
            expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
        });

        // Typing in the purpose field clears the server error, re-enabling the Create button
        const purposeInput = screen.getByLabelText('Channel Purpose');
        await userEvent.type(purposeInput, 'x');

        await waitFor(() => {
            expect(createButton).toBeEnabled();
        });

        await userEvent.click(createButton);

        await waitFor(() => {
            expect(onCreate).toHaveBeenCalledTimes(2);
            expect(switchToChannel).toHaveBeenCalledWith(mockChannel);
        });
    });

    test('pluginCanCreate resets to true when switching channel type away from a plugin option', async () => {
        let effectFired = false;
        const ExtraContent = ({setCanCreate}: {setCanCreate: (v: boolean) => void}) => {
            React.useEffect(() => {
                if (!effectFired) {
                    effectFired = true;
                    setCanCreate(false);
                }
            }, [setCanCreate]);
            return <div data-testid='extra-blocker'/>;
        };
        renderWithContext(<NewChannelModal/>, stateWithOption({extraContent: ExtraContent}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /create channel/i})).toBeDisabled();
        });

        const publicButton = screen.getByText('Public Channel');
        await userEvent.click(publicButton);

        await userEvent.click(pluginButton);

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /create channel/i})).toBeEnabled();
        });
    });

    function stateWithTwoOptions(option1OnCreate: jest.Mock, option2OnCreate: jest.Mock): DeepPartial<GlobalState> {
        return {
            ...baseState,
            plugins: {
                ...baseState.plugins,
                components: {
                    ChannelTypeOption: [
                        {
                            id: 'plugin-option-1',
                            pluginId: 'test-plugin',
                            label: 'Plugin Option 1',
                            description: 'First plugin option',
                            icon: <i data-testid='plugin-icon-1'/>,
                            isAvailable: () => true,
                            onCreate: option1OnCreate,
                        },
                        {
                            id: 'plugin-option-2',
                            pluginId: 'test-plugin',
                            label: 'Plugin Option 2',
                            description: 'Second plugin option',
                            icon: <i data-testid='plugin-icon-2'/>,
                            isAvailable: () => true,
                            onCreate: option2OnCreate,
                        },
                    ],
                },
            },
        } as DeepPartial<GlobalState>;
    }

    test('when multiple plugin options are registered only the selected one fires onCreate', async () => {
        const option1OnCreate = jest.fn().mockResolvedValue({status: 'created', channel: mockChannel});
        const option2OnCreate = jest.fn().mockResolvedValue({status: 'created', channel: mockChannel});
        renderWithContext(<NewChannelModal/>, stateWithTwoOptions(option1OnCreate, option2OnCreate));

        const option2Button = screen.getByText('Plugin Option 2');
        await userEvent.click(option2Button);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(option2OnCreate).toHaveBeenCalledTimes(1);
            expect(option2OnCreate).toHaveBeenCalledWith(expect.objectContaining({type: 'plugin-option-2'}));
        });
        expect(option1OnCreate).not.toHaveBeenCalled();
    });

    test('malformed result: unknown status - modal stays open, generic error shown, console.error called', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const onCreate = jest.fn().mockResolvedValue({status: 'unknown'});
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
        expect(createButton).toBeDisabled();
        expect(switchToChannel).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('test-plugin:plugin-option'),
            expect.anything(),
        );
        consoleSpy.mockRestore();
    });

    test('malformed result: created without channel - modal stays open, generic error shown, console.error called', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const onCreate = jest.fn().mockResolvedValue({status: 'created', channel: undefined});
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
        expect(switchToChannel).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('test-plugin:plugin-option'),
            expect.anything(),
        );
        consoleSpy.mockRestore();
    });

    test('malformed result: error without message - modal stays open, generic error shown, console.error called', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const onCreate = jest.fn().mockResolvedValue({status: 'error'});
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('test-plugin:plugin-option'),
            expect.anything(),
        );
        expect(switchToChannel).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    test('onCreate throws - console.error called with plugin and option identifiers', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const onCreate = jest.fn().mockRejectedValue(new Error('network failure'));
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
        expect(switchToChannel).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('test-plugin:plugin-option'),
            expect.anything(),
        );
        consoleSpy.mockRestore();
    });

    test('mid-flight guard: clicking another option while onCreate is pending leaves type unchanged', async () => {
        let resolveOnCreate!: (value: any) => void;
        const onCreate = jest.fn().mockReturnValue(
            new Promise((resolve) => {
                resolveOnCreate = resolve;
            }),
        );
        renderWithContext(<NewChannelModal/>, stateWithOption({onCreate}));

        const pluginButton = screen.getByText('Plugin Channel');
        await userEvent.click(pluginButton);

        const channelNameInput = screen.getByRole('textbox', {name: 'Channel name'});
        await userEvent.type(channelNameInput, 'My Channel');

        const createButton = screen.getByRole('button', {name: /create channel/i});
        await userEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByTestId('loadingSpinner')).toBeInTheDocument();
        });

        // Click "Public Channel" while onCreate is still pending
        const publicButton = screen.getByText('Public Channel');
        await userEvent.click(publicButton);

        // Plugin option should still be selected (type unchanged)
        expect(pluginButton.closest('button')).toHaveClass('selected');
        expect(publicButton.closest('button')).not.toHaveClass('selected');

        await act(async () => {
            resolveOnCreate({status: 'deferred'});
        });

        expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
        expect(pluginButton.closest('button')).toHaveClass('selected');
    });
});
