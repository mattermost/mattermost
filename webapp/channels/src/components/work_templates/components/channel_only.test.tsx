// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Constants, {suitePluginIds} from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';
import {GlobalState} from 'types/store';
import Permissions from 'mattermost-redux/constants/permissions';

jest.mock('mattermost-redux/actions/channels');

import ChannelOnly, {useChannelOnlyManager} from './channel_only';
import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {renderWithIntlAndStore} from 'tests/react_testing_utils';
import {DeepPartial} from '@mattermost/types/utilities';

type ChannelManager = ReturnType<typeof useChannelOnlyManager>

function mockChannelOnlyManager(partial: DeepPartial<ChannelManager>): ChannelManager {
    return {
        state: {
            canCreate: true,
            displayName: 'displayName',
            url: 'display-name',
            purpose: 'purposive',
            displayNameModified: true,
            urlModified: true,
            displayNameError: '',
            urlError: '',
            purposeError: '',
            serverError: '',
            type: Constants.OPEN_CHANNEL as 'O',
            canCreatePublicChannel: true,
            canCreatePrivateChannel: true,
            ...partial?.state,
            createBoardFromChannelPlugin: [],
        },
        set: {
            name: jest.fn(),
            type: jest.fn(),
            purpose: jest.fn(),
            url: jest.fn(),
            handleNameBlur: jest.fn(),
            canCreateFromPluggable: jest.fn(),
            actionFromPluggable: jest.fn(),
        },
        actions: {
            handleOnModalConfirm: jest.fn(),
        },
    };
}

describe('components/new_channel_modal', () => {
    let mockState: GlobalState;
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
                components: {},
                plugins: {focalboard: {id: suitePluginIds.focalboard}},
            },
        } as unknown as GlobalState;
    });

    test('when all data filled, can submit', () => {
        const manager = mockChannelOnlyManager({});

        renderWithIntlAndStore(
            <ChannelOnly
                tryTemplates={jest.fn()}
                manager={manager}
                workTemplatesEnabled={false}
            />,
             mockState,
        );

        // channel name
        screen.getByText('Channel name');

        // url
        screen.getByText(`/${manager.state.url}`, {exact: false});
        const editUrl = screen.getByText('Edit');
        expect(editUrl).toBeInTheDocument();

        // public selector
        screen.getByLabelText('Globe Circle Solid Icon');
        screen.getByText('Public Channel');
        screen.getByText('Anyone can join');

        // private selector
        screen.getByLabelText('Lock Circle Solid Icon');
        screen.getByText('Private Channel');
        screen.getByText('Only invited members');

        // purpose
        screen.getByPlaceholderText('Enter a purpose for this channel (optional)');
        screen.getByText('This will be displayed when browsing for channels.');

        // footer
        screen.getByText('Cancel');
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).not.toBeDisabled();
    });

    test('renders channel name', () => {
        const manager = mockChannelOnlyManager({});
        manager.state.displayName = 'channel name renders';

        renderWithIntlAndStore(
            <ChannelOnly
                tryTemplates={jest.fn()}
                manager={manager}
                workTemplatesEnabled={false}
             />,
            mockState,
        );
        screen.getByDisplayValue(manager.state.displayName);
    });

    test('input renders url', () => {
        const manager = mockChannelOnlyManager({});
        manager.state.url = '/does-this-render';

        renderWithIntlAndStore(
            <ChannelOnly
                tryTemplates={jest.fn()}
                manager={manager}
                workTemplatesEnabled={false}
            />,
            mockState,
        );
        screen.getByText(`/${manager.state.url}`, {exact: false});
    });

    test('renders purpose', () => {
        const manager = mockChannelOnlyManager({});
        manager.state.purpose = 'Purpose of channel';

        renderWithIntlAndStore(<ChannelOnly
            tryTemplates={jest.fn()}
            manager={manager}
            workTemplatesEnabled={false}
                               />, mockState);
        screen.getByText(manager.state.purpose);
    });

    test('should disable confirm according to manager', () => {
        const manager = mockChannelOnlyManager({});
        manager.state.canCreate = false;

        renderWithIntlAndStore(
            <ChannelOnly
                tryTemplates={jest.fn()}
                manager={manager}
                workTemplatesEnabled={false}
            />,
            mockState,
        );
        const createChannelButton = screen.getByText('Create channel');
        expect(createChannelButton).toBeDisabled();
    });

    test('submit creates channel', () => {
        const manager = mockChannelOnlyManager({});

        renderWithIntlAndStore(
            <ChannelOnly
                tryTemplates={jest.fn()}
                manager={manager}
                workTemplatesEnabled={false}
            />,
            mockState,
        );
        const createChannelButton = screen.getByText('Create channel');

        userEvent.click(createChannelButton);
        expect(manager.actions.handleOnModalConfirm).toHaveBeenCalled();
    });

    test('when work templates are enabled, shows UI that allows switching to a mode that allows creating a channel from a template', () => {
        const manager = mockChannelOnlyManager({});
        const tryTemplates=jest.fn();

        renderWithIntlAndStore(
            <ChannelOnly
                tryTemplates={tryTemplates}
                manager={manager}
                workTemplatesEnabled={true}
            />,
            mockState,
        );
        const cta = screen.getByText('Try a template');

        userEvent.click(cta);
        expect(tryTemplates).toHaveBeenCalled();
    });
});
