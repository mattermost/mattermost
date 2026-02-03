// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, render} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import {TestHelper} from '../../../utils/test_helper';

import CallButton, {isUserInCall} from './index';

describe('isUserInCall', () => {
    test('missing state', () => {
        expect(isUserInCall({
            'plugins-com.mattermost.calls': {},
        } as any, 'userA', 'channelID')).toBe(false);
    });

    test('call state missing', () => {
        expect(isUserInCall({
            'plugins-com.mattermost.calls': {
                sessions: {
                    channelID: null,
                },
            },
        } as any, 'userA', 'channelID')).toBe(false);
    });

    test('user not in call', () => {
        expect(isUserInCall({
            'plugins-com.mattermost.calls': {
                sessions: {
                    channelID: {
                        sessionB: {
                            user_id: 'userB',
                        },
                    },
                },
            },
        } as any, 'userA', 'channelID')).toBe(false);
    });

    test('user in call', () => {
        expect(isUserInCall({
            'plugins-com.mattermost.calls': {
                sessions: {
                    channelID: {
                        sessionB: {
                            user_id: 'userB',
                        },
                        sessionA: {
                            user_id: 'userA',
                        },
                    },
                },
            },
        } as any, 'userA', 'channelID')).toBe(true);
    });
});

describe('CallButton', () => {
    const mockStore = configureStore();
    const userId = 'user1';
    const currentUserId = 'current_user';
    const dmChannelId = 'dm_channel_id';
    const baseProps = {
        userId,
        currentUserId,
        fullname: 'Test User',
        username: 'testuser',
    };
    const PluginComponent = () => {
        return <button>{'Start Call'}</button>;
    };

    test('should not render when calls are disabled', () => {
        const store = mockStore({
            'plugins-com.mattermost.calls': {
                enabled: false,
            },
            entities: {
                channels: {
                    channels: {
                        currentChannelId: dmChannelId,
                        channels: {
                            current_channel_id: TestHelper.getChannelMock({
                                id: dmChannelId,
                                name: `${currentUserId}__${userId}`,
                                display_name: `${currentUserId}__${userId}`,
                                delete_at: 0,
                                type: 'D',
                            }),
                        },
                    },
                },
                users: {
                    profiles: {
                        [currentUserId]: TestHelper.getUserMock({
                            id: currentUserId,
                            roles: 'system_user',
                        }),
                    },
                },
            },
            plugins: {
                plugins: {
                    'com.mattermost.calls': {
                        id: 'com.mattermost.calls',
                        version: '1.0.0',
                    },
                },
            },
        });

        render(
            <Provider store={store}>
                <CallButton {...baseProps}/>
            </Provider>,
        );

        expect(screen.queryByTestId('startCallButton')).not.toBeInTheDocument();
    });

    test('should render for admin even in test mode', () => {
        const store = mockStore({
            'plugins-com.mattermost.calls': {
                enabled: true,
                config: {
                    DefaultEnabled: false,
                },
            },
            entities: {
                channels: {
                    currentChannelId: dmChannelId,
                    channels: {
                        current_channel_id: TestHelper.getChannelMock({
                            id: dmChannelId,
                            name: `${currentUserId}__${userId}`,
                            display_name: `${currentUserId}__${userId}`,
                            delete_at: 0,
                            type: 'D',
                        }),
                    },
                    myMembers: {
                        [dmChannelId]: TestHelper.getChannelMembershipMock({channel_id: dmChannelId}),
                    },
                },
                users: {
                    currentUserId,
                    profiles: {
                        [currentUserId]: TestHelper.getUserMock({
                            id: currentUserId,
                            roles: 'system_admin',
                        }),
                    },
                },
            },
            plugins: {
                plugins: {
                    'com.mattermost.calls': {
                        id: 'com.mattermost.calls',
                        version: '1.0.0',
                    },
                },
                components: {
                    CallButton: [{
                        id: 'CallButton',
                        plugin_id: 'com.mattermost.calls',
                        button: PluginComponent,
                    }],
                },
            },
            views: {
                rhs: {
                    isSidebarOpen: false,
                },
            },
        });

        render(
            <Provider store={store}>
                <CallButton {...baseProps}/>
            </Provider>,
        );

        expect(screen.getByLabelText('Start Call')).toBeInTheDocument();
    });

    test('should render when calls are enabled and not in test mode', () => {
        const store = mockStore({
            'plugins-com.mattermost.calls': {
                enabled: true,
                config: {
                    DefaultEnabled: true,
                },
                channels: {},
                sessions: {},
            },
            entities: {
                channels: {
                    currentChannelId: dmChannelId,
                    channels: {
                        current_channel_id: TestHelper.getChannelMock({
                            id: dmChannelId,
                            name: `${currentUserId}__${userId}`,
                            display_name: `${currentUserId}__${userId}`,
                            delete_at: 0,
                            type: 'D',
                        }),
                    },
                    myMembers: {
                        [dmChannelId]: TestHelper.getChannelMembershipMock({channel_id: dmChannelId}),
                    },
                },
                users: {
                    currentUserId,
                    profiles: {
                        [currentUserId]: TestHelper.getUserMock({
                            id: currentUserId,
                            roles: 'system_admin',
                        }),
                    },
                },
            },
            plugins: {
                plugins: {
                    'com.mattermost.calls': {
                        id: 'com.mattermost.calls',
                        version: '1.0.0',
                    },
                },
                components: {
                    CallButton: [{
                        id: 'CallButton',
                        plugin_id: 'com.mattermost.calls',
                        button: PluginComponent,
                    }],
                },
            },
            views: {
                rhs: {
                    isSidebarOpen: false,
                },
            },
        });

        render(
            <Provider store={store}>
                <CallButton {...baseProps}/>
            </Provider>,
        );

        expect(screen.getByLabelText('Start Call')).toBeInTheDocument();
    });

    test('should render when channel is explicitly enabled regardless of test mode', () => {
        const store = mockStore({
            'plugins-com.mattermost.calls': {
                enabled: true,
                config: {
                    DefaultEnabled: false,
                },
                channels: {
                    [dmChannelId]: {enabled: true},
                },
                sessions: {},
            },
            entities: {
                channels: {
                    currentChannelId: dmChannelId,
                    channels: {
                        current_channel_id: TestHelper.getChannelMock({
                            id: dmChannelId,
                            name: `${currentUserId}__${userId}`,
                            display_name: `${currentUserId}__${userId}`,
                            delete_at: 0,
                            type: 'D',
                        }),
                    },
                    myMembers: {
                        [dmChannelId]: TestHelper.getChannelMembershipMock({channel_id: dmChannelId}),
                    },
                },
                users: {
                    currentUserId,
                    profiles: {
                        [currentUserId]: TestHelper.getUserMock({
                            id: currentUserId,
                            roles: 'system_admin',
                        }),
                    },
                },
            },
            plugins: {
                plugins: {
                    'com.mattermost.calls': {
                        id: 'com.mattermost.calls',
                        version: '1.0.0',
                    },
                },
                components: {
                    CallButton: [{
                        id: 'CallButton',
                        plugin_id: 'com.mattermost.calls',
                        button: PluginComponent,
                    }],
                },
            },
            views: {
                rhs: {
                    isSidebarOpen: false,
                },
            },
        });

        render(
            <Provider store={store}>
                <CallButton {...baseProps}/>
            </Provider>,
        );

        expect(screen.getByLabelText('Start Call')).toBeInTheDocument();
    });

    test('should not render when channel is explicitly disabled', () => {
        const store = mockStore({
            'plugins-com.mattermost.calls': {
                enabled: true,
                config: {
                    DefaultEnabled: true,
                },
                channels: {
                    [dmChannelId]: {enabled: false},
                },
                sessions: {},
            },
            entities: {
                channels: {
                    currentChannelId: dmChannelId,
                    channels: {
                        current_channel_id: TestHelper.getChannelMock({
                            id: dmChannelId,
                            name: `${currentUserId}__${userId}`,
                            display_name: `${currentUserId}__${userId}`,
                            delete_at: 0,
                            type: 'D',
                        }),
                    },
                    myMembers: {
                        [dmChannelId]: TestHelper.getChannelMembershipMock({channel_id: dmChannelId}),
                    },
                },
                users: {
                    profiles: {
                        [currentUserId]: TestHelper.getUserMock({
                            id: currentUserId,
                            roles: 'system_admin',
                        }),
                    },
                },
            },
            plugins: {
                plugins: {
                    'com.mattermost.calls': {
                        id: 'com.mattermost.calls',
                        version: '1.0.0',
                    },
                },
            },
        });

        render(
            <Provider store={store}>
                <CallButton {...baseProps}/>
            </Provider>,
        );

        expect(screen.queryByLabelText('Start Call')).not.toBeInTheDocument();
    });

    test('should disable button when there is an ongoing call', () => {
        const store = mockStore({
            'plugins-com.mattermost.calls': {
                enabled: true,
                config: {
                    DefaultEnabled: true,
                },
                sessions: {
                    [dmChannelId]: {
                        session1: {
                            user_id: currentUserId,
                        },
                    },
                },
            },
            entities: {
                channels: {
                    currentChannelId: dmChannelId,
                    channels: {
                        current_channel_id: TestHelper.getChannelMock({
                            id: dmChannelId,
                            name: `${currentUserId}__${userId}`,
                            display_name: `${currentUserId}__${userId}`,
                            delete_at: 0,
                            type: 'D',
                        }),
                    },
                    myMembers: {
                        [dmChannelId]: TestHelper.getChannelMembershipMock({channel_id: dmChannelId}),
                    },
                },
                users: {
                    profiles: {
                        [currentUserId]: TestHelper.getUserMock({
                            id: currentUserId,
                            roles: 'system_admin',
                        }),
                    },
                },
            },
            plugins: {
                plugins: {
                    'com.mattermost.calls': {
                        id: 'com.mattermost.calls',
                        version: '1.0.0',
                    },
                },
            },
        });

        render(
            <Provider store={store}>
                <CallButton {...baseProps}/>
            </Provider>,
        );

        const button = screen.getByLabelText('Call with Test User is ongoing');
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });
});
