// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';
import {shallow} from 'enzyme';

import {mountWithIntl} from 'tests/helpers/intl-test-helper';

import GenericModal from 'components/generic_modal';
import Input from 'components/widgets/inputs/input/input';
import URLInput from 'components/widgets/inputs/url_input/url_input';
import PublicPrivateSelector from 'components/widgets/public-private-selector/public-private-selector';

import Constants, {suitePluginIds} from 'utils/constants';
import {cleanUpUrlable} from 'utils/url';
import {GlobalState} from 'types/store';
import Permissions from 'mattermost-redux/constants/permissions';
import {createChannel} from 'mattermost-redux/actions/channels';

import {ChannelType} from '@mattermost/types/channels';

jest.mock('mattermost-redux/actions/channels');

import NewChannelModal from './new_channel_modal';

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

    test('should match snapshot', () => {
        expect(
            shallow(
                <NewChannelModal/>,
            ),
        ).toMatchSnapshot();
    });

    test('should handle display name change', () => {
        const value = 'Channel name';
        const mockChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value,
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const wrapper = shallow(
            <NewChannelModal/>,
        );

        // Change display name
        let input = wrapper.find(Input).first();
        input.props().onChange!(mockChangeEvent);

        // Display name should have been updated
        input = wrapper.find(Input).first();
        expect(input.props().value).toEqual(value);

        // URL should have been changed according to display name
        const urlInput = wrapper.find(URLInput);
        expect(urlInput.props().pathInfo).toEqual(cleanUpUrlable(value));
    });

    test('should handle url change', () => {
        const value = 'Channel name';
        const mockInputChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value,
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        const mockInputChangeUpdatedEvent = {
            preventDefault: jest.fn(),
            target: {
                value: `${value} updated`,
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const url = 'channel-name-new';
        const mockURLInputChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value: url,
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const wrapper = shallow(
            <NewChannelModal/>,
        );

        // Change display name
        let input = wrapper.find(Input).first();
        input.props().onChange!(mockInputChangeEvent);

        // URL should have been changed according to display name
        let urlInput = wrapper.find(URLInput);
        expect(urlInput.props().pathInfo).toEqual(cleanUpUrlable(value));

        // Change URL
        urlInput.props().onChange!(mockURLInputChangeEvent);

        // URL should have been updated
        urlInput = wrapper.find(URLInput);
        expect(urlInput.props().pathInfo).toEqual(url);

        // Change display name again
        input = wrapper.find(Input).first();
        input.props().onChange!(mockInputChangeUpdatedEvent);

        // URL should NOT be updated
        urlInput = wrapper.find(URLInput);
        expect(urlInput.props().pathInfo).toEqual(url);
    });

    test('should handle type changes', () => {
        const typePublic = Constants.OPEN_CHANNEL as ChannelType;
        const typePrivate = Constants.PRIVATE_CHANNEL as ChannelType;

        const wrapper = shallow(
            <NewChannelModal/>,
        );

        // Change type to private
        let selector = wrapper.find(PublicPrivateSelector);
        selector.props().onChange!(typePrivate);

        // Type should have been updated to private
        selector = wrapper.find(PublicPrivateSelector);
        expect(selector.props().selected).toEqual(typePrivate);

        // Change type to private
        selector = wrapper.find(PublicPrivateSelector);
        selector.props().onChange!(typePublic);

        // Type should have been updated to public
        selector = wrapper.find(PublicPrivateSelector);
        expect(selector.props().selected).toEqual(typePublic);
    });

    test('should handle purpose changes', () => {
        const value = 'Purpose';
        const mockChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value,
            },
        } as unknown as React.ChangeEvent<HTMLTextAreaElement>;

        const wrapper = shallow(
            <NewChannelModal/>,
        );

        // Change purpose
        let textarea = wrapper.find('textarea');
        textarea.props().onChange!(mockChangeEvent);

        // Purpose should have been updated
        textarea = wrapper.find('textarea');
        expect(textarea.props().value).toEqual(value);
    });

    test('should enable confirm button when having valid display name, url and type', () => {
        const mockChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value: 'Channel name',
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const wrapper = shallow(
            <NewChannelModal/>,
        );

        // Confirm button should be disabled
        let genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().isConfirmDisabled).toEqual(true);

        // Change display name
        const input = wrapper.find(Input).first();
        input.props().onChange!(mockChangeEvent);

        // Change type to private
        const selector = wrapper.find(PublicPrivateSelector);
        selector.props().onChange!(Constants.PRIVATE_CHANNEL as ChannelType);

        // Confirm button should be enabled
        genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().isConfirmDisabled).toEqual(false);
    });

    test('should disable confirm button when display name in error', () => {
        const mockChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value: 'Channel name',
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        const mockChangeInvalidEvent = {
            preventDefault: jest.fn(),
            target: {
                value: '',
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const wrapper = shallow(
            <NewChannelModal/>,
        );

        // Change display name
        let input = wrapper.find(Input).first();
        input.props().onChange!(mockChangeEvent);

        // Change type to private
        const selector = wrapper.find(PublicPrivateSelector);
        selector.props().onChange!(Constants.PRIVATE_CHANNEL as ChannelType);

        // Confirm button should be enabled
        let genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().isConfirmDisabled).toEqual(false);

        // Change display name to invalid
        input = wrapper.find(Input).first();
        input.props().onChange!(mockChangeInvalidEvent);

        // Confirm button should be disabled
        genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().isConfirmDisabled).toEqual(true);
    });

    test('should disable confirm button when url in error', () => {
        const mockChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value: 'Channel name',
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        const mockChangeURLInvalidEvent = {
            preventDefault: jest.fn(),
            target: {
                value: 'c-',
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const wrapper = shallow(
            <NewChannelModal/>,
        );

        // Change display name
        const input = wrapper.find(Input).first();
        input.props().onChange!(mockChangeEvent);

        // Change type to private
        const selector = wrapper.find(PublicPrivateSelector);
        selector.props().onChange!(Constants.PRIVATE_CHANNEL as ChannelType);

        // Confirm button should be enabled
        let genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().isConfirmDisabled).toEqual(false);

        // Change url to invalid
        const urlInput = wrapper.find(URLInput);
        urlInput.props().onChange!(mockChangeURLInvalidEvent);

        // Confirm button should be disabled
        genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().isConfirmDisabled).toEqual(true);
    });

    test('should disable confirm button when server error', async () => {
        const mockChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value: 'Channel name',
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const wrapper = shallow(
            <NewChannelModal/>,
        );

        // Confirm button should be disabled
        let genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().isConfirmDisabled).toEqual(true);

        // Change display name
        const input = wrapper.find(Input).first();
        input.props().onChange!(mockChangeEvent);

        // Change type to private
        const selector = wrapper.find(PublicPrivateSelector);
        selector.props().onChange!(Constants.PRIVATE_CHANNEL as ChannelType);

        // Confirm button should be enabled
        genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().isConfirmDisabled).toEqual(false);

        // Submit
        await genericModal.props().handleConfirm!();

        genericModal = wrapper.find(GenericModal);
        expect(genericModal.props().errorText).toEqual('Something went wrong. Please try again.');
        expect(genericModal.props().isConfirmDisabled).toEqual(true);
    });

    test('should request team creation on submit', async () => {
        const name = 'Channel name';
        const mockChangeEvent = {
            preventDefault: jest.fn(),
            target: {
                value: name,
            },
        } as unknown as React.ChangeEvent<HTMLInputElement>;

        const wrapper = mountWithIntl(
            <NewChannelModal/>,
        );

        const genericModal = wrapper.find('GenericModal');
        const displayName = genericModal.find('.new-channel-modal-name-input');
        const confirmButton = genericModal.find('button[type=\'submit\']');

        // Confirm button should be disabled
        expect((confirmButton.instance() as unknown as HTMLButtonElement).disabled).toEqual(true);

        // Enter data
        displayName.simulate('change', mockChangeEvent);

        // Display name should be updated
        expect((displayName.instance() as unknown as HTMLInputElement).value).toEqual(name);

        // Confirm button should be enabled
        expect((confirmButton.instance() as unknown as HTMLButtonElement).disabled).toEqual(false);

        // Submit
        await act(async () => {
            confirmButton.simulate('click');
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
