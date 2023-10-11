// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import {CustomStatusDuration} from '@mattermost/types/users';

import {General} from 'mattermost-redux/constants';

import {checkUserInCall} from 'components/profile_popover';
import ProfilePopover from 'components/profile_popover/profile_popover';

import Pluggable from 'plugins/pluggable';
import {mountWithIntl, shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {mockStore} from 'tests/test_store';
import {TestHelper} from 'utils/test_helper';

describe('components/ProfilePopover', () => {
    const baseProps = {
        enableTimezone: false,
        userId: '0',
        user: TestHelper.getUserMock({
            username: 'some_username',
        }),
        hide: jest.fn(),
        src: 'src',
        currentUserId: '',
        currentTeamId: 'team_id',
        isChannelAdmin: false,
        isTeamAdmin: false,
        isInCurrentTeam: true,
        teamUrl: '',
        canManageAnyChannelMembersInCurrentTeam: true,
        isCustomStatusEnabled: true,
        isCustomStatusExpired: false,
        isMobileView: false,
        actions: {
            getMembershipForEntities: jest.fn(),
            openDirectChannelToUserId: jest.fn(),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            loadBot: jest.fn(),
        },
        lastActivityTimestamp: 1632146562846,
        enableLastActiveTime: true,
        timestampUnits: [
            'now',
            'minute',
            'hour',
        ],
        isCallsEnabled: true,
        isCallsDefaultEnabledOnAllChannels: true,
        teammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
        isAnyModalOpen: false,
    };

    const initialState = {
        entities: {
            teams: {},
            channels: {
                channels: {},
                myMembers: {},
            },
            general: {
                config: {},
            },
            users: {
                currentUserId: '',
            },
            preferences: {
                myPreferences: {},
            },
            groups: {
                groups: {},
                myGroups: [],
            },
            emojis: {
                customEmoji: {},
            },
        },
        plugins: {
            components: {
                CallButton: [],
            },
        },
        views: {
            rhs: {
                isSidebarOpen: false,
            },
        },
    };

    test('should match snapshot', () => {
        const props = {...baseProps};

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for shared user', () => {
        const props = {
            ...baseProps,
            user: TestHelper.getUserMock({
                username: 'shared_user',
                first_name: 'shared',
                remote_id: 'fakeuser',
            }),
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should have bot description', () => {
        const props = {
            ...baseProps,
            user: TestHelper.getUserMock({
                is_bot: true,
                bot_description: 'bot description',
            }),
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper.containsMatchingElement(
            <div
                key='bot-description'
            >
                {'bot description'}
            </div>,
        )).toEqual(true);
    });

    test('should hide add-to-channel option if not on team', () => {
        const props = {...baseProps};
        props.isInCurrentTeam = false;

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match props passed into Pluggable component', () => {
        const hide = jest.fn();
        const status = 'online';
        const props = {...baseProps, hide, status};

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );

        const pluggableProps = {
            hide,
            status,
            user: props.user,
        };
        expect(wrapper.find(Pluggable).first().props()).toEqual({...pluggableProps, pluggableName: 'PopoverUserAttributes'});
        expect(wrapper.find(Pluggable).last().props()).toEqual({...pluggableProps, pluggableName: 'PopoverUserActions'});
    });

    test('should match snapshot with custom status', () => {
        const customStatus = {
            emoji: 'calendar',
            text: 'In a meeting',
            duration: CustomStatusDuration.TODAY,
            expires_at: '2021-05-03T23:59:59.000Z',
        };
        const props = {
            ...baseProps,
            customStatus,
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with custom status not set but can set', () => {
        const props = {
            ...baseProps,
            user: {
                ...baseProps.user,
                id: '',
            },
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with custom status expired', () => {
        const customStatus = {
            emoji: 'calendar',
            text: 'In a meeting',
            duration: CustomStatusDuration.TODAY,
            expires_at: '2021-05-03T23:59:59.000Z',
        };
        const props = {
            ...baseProps,
            isCustomStatusExpired: true,
            customStatus,
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with last active display', () => {
        const props = {
            ...baseProps,
            status: 'offline',
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with no last active display because it is disabled', () => {
        const props = {
            ...baseProps,
            enableLastActiveTime: false,
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when calls are disabled', () => {
        const props = {
            ...baseProps,
            isCallsEnabled: false,
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should disable start call button when user is in another call', () => {
        const props = {
            ...baseProps,
            isUserInCall: true,
        };

        const wrapper = shallowWithIntl(
            <ProfilePopover {...props}/>,
        );
        expect(wrapper.find('#startCallButton').hasClass('icon-btn-disabled')).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });

    test('should show the start call button when isCallsDefaultEnabledOnAllChannels, isCallsCanBeDisabledOnSpecificChannels is false and callsChannelState.enabled is true', () => {
        const mock = mockStore(initialState);
        const props = {
            ...baseProps,
            isCallsDefaultEnabledOnAllChannels: false,
            isCallsCanBeDisabledOnSpecificChannels: false,
        };

        const wrapper = mountWithIntl(
            <Provider store={mock.store}>
                <ProfilePopover {...props}/>
            </Provider>,
        );
        expect(wrapper.find('ProfilePopoverCallButton').exists()).toBe(true);
        expect(wrapper).toMatchSnapshot();
    });
});

describe('checkUserInCall', () => {
    test('missing state', () => {
        expect(checkUserInCall({
            'plugins-com.mattermost.calls': {},
        } as any, 'userA')).toBe(false);
    });

    test('call state missing', () => {
        expect(checkUserInCall({
            'plugins-com.mattermost.calls': {
                voiceConnectedProfiles: {
                    channelID: null,
                },
            },
        } as any, 'userA')).toBe(false);
    });

    test('user not in call', () => {
        expect(checkUserInCall({
            'plugins-com.mattermost.calls': {
                voiceConnectedProfiles: {
                    channelID: [
                        {
                            id: 'userB',
                        },
                    ],
                },
            },
        } as any, 'userA')).toBe(false);
    });

    test('user in call', () => {
        expect(checkUserInCall({
            'plugins-com.mattermost.calls': {
                voiceConnectedProfiles: {
                    channelID: [
                        {
                            id: 'userB',
                        },
                        {
                            id: 'userA',
                        },
                    ],
                },
            },
        } as any, 'userA')).toBe(true);
    });
});
