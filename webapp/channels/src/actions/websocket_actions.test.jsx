// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getProfilesAndStatusesForPosts,
    getThreadsForPosts,
    receivedNewPost,
} from 'mattermost-redux/actions/posts';
import {getGroup} from 'mattermost-redux/actions/groups';
import {ChannelTypes, UserTypes, CloudTypes} from 'mattermost-redux/action_types';
import {getUser} from 'mattermost-redux/actions/users';

import {handleNewPost} from 'actions/post_actions';
import {closeRightHandSide} from 'actions/views/rhs';
import {syncPostsInChannel} from 'actions/views/channel';

import store from 'stores/redux_store.jsx';

import configureStore from 'tests/test_store';

import {getHistory} from 'utils/browser_history';
import Constants, {SocketEvents, UserStatuses, ActionTypes} from 'utils/constants';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';

import {
    handleChannelUpdatedEvent,
    handleEvent,
    handleNewPostEvent,
    handleNewPostEvents,
    handlePluginEnabled,
    handlePluginDisabled,
    handlePostEditEvent,
    handlePostUnreadEvent,
    handleUserRemovedEvent,
    handleLeaveTeamEvent,
    reconnect,
    handleAppsPluginEnabled,
    handleAppsPluginDisabled,
    handleCloudSubscriptionChanged,
    handleGroupAddedMemberEvent,
} from './websocket_actions';

jest.mock('mattermost-redux/actions/posts', () => ({
    ...jest.requireActual('mattermost-redux/actions/posts'),
    getThreadsForPosts: jest.fn(() => ({type: 'GET_THREADS_FOR_POSTS'})),
    getProfilesAndStatusesForPosts: jest.fn(),
}));

jest.mock('mattermost-redux/actions/groups', () => ({
    ...jest.requireActual('mattermost-redux/actions/groups'),
    getGroup: jest.fn(() => ({type: 'RECEIVED_GROUP'})),
}));

jest.mock('mattermost-redux/actions/users', () => ({
    getMissingProfilesByIds: jest.fn(() => ({type: 'GET_MISSING_PROFILES_BY_IDS'})),
    getStatusesByIds: jest.fn(() => ({type: 'GET_STATUSES_BY_IDS'})),
    getUser: jest.fn(() => ({type: 'GET_STATUSES_BY_IDS'})),
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    getChannelStats: jest.fn(() => ({type: 'GET_CHANNEL_STATS'})),
}));

jest.mock('actions/post_actions', () => ({
    ...jest.requireActual('actions/post_actions'),
    handleNewPost: jest.fn(() => ({type: 'HANDLE_NEW_POST'})),
}));

jest.mock('actions/global_actions', () => ({
    ...jest.requireActual('actions/global_actions'),
    redirectUserToDefaultTeam: jest.fn(),
}));

jest.mock('actions/views/channel', () => ({
    ...jest.requireActual('actions/views/channel'),
    syncPostsInChannel: jest.fn(),
}));

jest.mock('plugins', () => ({
    ...jest.requireActual('plugins'),
    loadPluginsIfNecessary: jest.fn(() => Promise.resolve()),
}));

let mockState = {
    entities: {
        users: {
            currentUserId: 'currentUserId',
            profiles: {
                currentUserId: {
                    id: 'currentUserId',
                    roles: 'system_guest',
                },
                user: {
                    id: 'user',
                    roles: 'system_guest',
                },
            },
            statuses: {
                user: 'away',
            },
        },
        roles: {
            roles: {
                system_guest: {
                    permissions: ['view_members'],
                },
            },
        },
        general: {
            config: {
                PluginsEnabled: 'true',
            },
        },
        groups: {
            syncables: {},
            groups: {
                'group-1': {
                    id: 'group-1',
                    name: 'group1',
                    display_name: 'Group 1',
                    member_count: 1,
                    allow_reference: true,
                },
            },
            stats: {},
            myGroups: {},
        },
        channels: {
            currentChannelId: 'otherChannel',
            channels: {
                otherChannel: {
                    id: 'otherChannel',
                    team_id: 'otherTeam',
                },
            },
            channelsInTeam: {
                team: ['channel1', 'channel2'],
            },
            membersInChannel: {
                otherChannel: {},
            },
        },
        preferences: {
            myPreferences: {},
        },
        teams: {
            currentTeamId: 'currentTeamId',
            teams: {
                currentTeamId: {
                    id: 'currentTeamId',
                    name: 'test',
                },
            },
        },
        posts: {
            posts: {
                post1: {id: 'post1', channel_id: 'otherChannel', create_at: '12341'},
                post2: {id: 'post2', channel_id: 'otherChannel', create_at: '12342'},
                post3: {id: 'post3', channel_id: 'channel2', create_at: '12343'},
                post4: {id: 'post4', channel_id: 'channel2', create_at: '12344'},
                post5: {id: 'post5', channel_id: 'otherChannel', create_at: '12345'},
            },
            postsInChannel: {
                otherChannel: [{
                    order: ['post5', 'post2', 'post1'],
                    recent: true,
                }],
            },
        },
    },
    views: {
        rhs: {
            selectedChannelId: 'otherChannel',
        },
    },
    websocket: {},
    plugins: {
        components: {
            RightHandSidebarComponent: [],
        },
    },
};

jest.mock('stores/redux_store', () => {
    return {
        dispatch: jest.fn(),
        getState: () => mockState,
    };
});

jest.mock('actions/views/rhs', () => ({
    closeRightHandSide: jest.fn(() => {
        return {type: ''};
    }),
}));

describe('handleEvent', () => {
    test('should dispatch channel updated event properly', () => {
        const msg = {event: SocketEvents.CHANNEL_UPDATED};

        handleEvent(msg);

        expect(store.dispatch).toHaveBeenCalled();
    });
});

describe('handlePostEditEvent', () => {
    test('post edited', async () => {
        const post = '{"id":"test","create_at":123,"update_at":123,"user_id":"user","channel_id":"12345","root_id":"","message":"asd","pending_post_id":"2345","metadata":{}}';
        const expectedAction = {type: 'RECEIVED_POST', data: JSON.parse(post), features: {crtEnabled: false}};
        const msg = {
            data: {
                post,
            },
            broadcast: {
                channel_id: '1234657',
            },
        };

        handlePostEditEvent(msg);
        expect(store.dispatch).toHaveBeenCalledWith(expectedAction);
    });
});

describe('handleGroupAddedMemberEvent', () => {
    test('add to group in state', async () => {
        const testStore = configureStore(mockState);
        const msg = {
            data: {
                group_member: '{"group_id":"group-1","user_id":"currentUserId","create_at":1691178673417,"delete_at":0}',
            },
            broadcast: {
                user_id: 'currentUserId',
            },
        };

        testStore.dispatch(handleGroupAddedMemberEvent(msg));
        expect(store.dispatch).toHaveBeenCalledWith({
            type: 'ADD_MY_GROUP',
            id: 'group-1',
        });
    });

    test('add to group not in state', async () => {
        const testStore = configureStore(mockState);
        const msg = {
            data: {
                group_member: '{"group_id":"group-2","user_id":"currentUserId","create_at":1691178673417,"delete_at":0}',
            },
            broadcast: {
                user_id: 'currentUserId',
            },
        };

        testStore.dispatch(handleGroupAddedMemberEvent(msg));
        expect(getGroup).toHaveBeenCalled();
        expect(testStore.getActions()).toEqual([{type: 'RECEIVED_GROUP'}]);
    });
});

describe('handlePostUnreadEvent', () => {
    test('post marked as unred', async () => {
        const msgData = {last_viewed_at: 123, msg_count: 40, mention_count: 1};
        const expectedData = {lastViewedAt: 123, msgCount: 40, mentionCount: 1, channelId: 'channel1'};
        const expectedAction = {type: 'POST_UNREAD_SUCCESS', data: expectedData};
        const msg = {
            data: msgData,
            broadcast: {
                channel_id: 'channel1',
            },
        };

        handlePostUnreadEvent(msg);
        expect(store.dispatch).toHaveBeenCalledWith(expectedAction);
    });
});

describe('handleUserRemovedEvent', () => {
    const currentChannelId = mockState.entities.channels.currentChannelId;
    const currentUserId = mockState.entities.users.currentUserId;

    const otherChannelId = 'yetAnotherChannel';
    const otherUserId1 = 'otherUser1';
    const otherUserId2 = 'otherUser2';

    let redirectUserToDefaultTeam;
    beforeEach(async () => {
        const globalActions = require('actions/global_actions'); // eslint-disable-line global-require
        redirectUserToDefaultTeam = globalActions.redirectUserToDefaultTeam;
        redirectUserToDefaultTeam.mockReset();
    });

    test('should close RHS', () => {
        const msg = {
            data: {
                channel_id: currentChannelId,
            },
            broadcast: {
                user_id: currentUserId,
            },
        };

        handleUserRemovedEvent(msg);
        expect(closeRightHandSide).toHaveBeenCalled();
    });

    test('shouldn\'t remove the team user if the user have view members permissions', () => {
        const expectedAction = {
            meta: {batch: true},
            payload: [
                {type: 'RECEIVED_PROFILE_NOT_IN_TEAM', data: {id: 'otherTeam', user_id: 'guestId'}},
                {type: 'REMOVE_MEMBER_FROM_TEAM', data: {team_id: 'otherTeam', user_id: 'guestId'}},
            ],
            type: 'BATCHING_REDUCER.BATCH',
        };
        const msg = {
            data: {
                channel_id: currentChannelId,
            },
            broadcast: {
                user_id: 'guestId',
            },
        };

        handleUserRemovedEvent(msg);
        expect(store.dispatch).not.toHaveBeenCalledWith(expectedAction);
    });

    test('should remove the team user if the user doesn\'t have view members permissions', () => {
        const expectedAction = {
            meta: {batch: true},
            payload: [
                {type: 'RECEIVED_PROFILE_NOT_IN_TEAM', data: {id: 'otherTeam', user_id: 'guestId'}},
                {type: 'REMOVE_MEMBER_FROM_TEAM', data: {team_id: 'otherTeam', user_id: 'guestId'}},
            ],
            type: 'BATCHING_REDUCER.BATCH',
        };
        const msg = {
            data: {
                channel_id: currentChannelId,
            },
            broadcast: {
                user_id: 'guestId',
            },
        };

        mockState = mergeObjects(
            mockState,
            {
                entities: {
                    roles: {
                        roles: {
                            system_guest: {
                                permissions: [],
                            },
                        },
                    },
                },
            },
        );

        handleUserRemovedEvent(msg);

        mockState = mergeObjects(
            mockState,
            {
                entities: {
                    roles: {
                        roles: {
                            system_guest: {
                                permissions: ['view_members'],
                            },
                        },
                    },
                },
            },
        );

        expect(store.dispatch).toHaveBeenCalledWith(expectedAction);
    });

    test('should load the remover_id user if is not available in the store', () => {
        const msg = {
            data: {
                channel_id: currentChannelId,
                remover_id: 'otherUser',
            },
            broadcast: {
                user_id: currentUserId,
            },
        };

        handleUserRemovedEvent(msg);
        expect(getUser).toHaveBeenCalledWith('otherUser');
    });

    test('should not load the remover_id user if is available in the store', () => {
        const msg = {
            data: {
                channel_id: currentChannelId,
                remover_id: 'user',
            },
            broadcast: {
                user_id: currentUserId,
            },
        };

        handleUserRemovedEvent(msg);
        expect(getUser).not.toHaveBeenCalled();
    });

    test('should redirect if the user removed is the current user from the current channel', () => {
        const msg = {
            data: {
                channel_id: currentChannelId,
                remover_id: 'user',
            },
            broadcast: {
                user_id: currentUserId,
            },
        };
        handleUserRemovedEvent(msg);
        expect(redirectUserToDefaultTeam).toHaveBeenCalled();
    });

    test('should redirect if the user removed themselves from the current channel', () => {
        const msg = {
            data: {
                channel_id: currentChannelId,
                remover_id: currentUserId,
            },
            broadcast: {
                user_id: currentUserId,
            },
        };
        handleUserRemovedEvent(msg);
        expect(redirectUserToDefaultTeam).toHaveBeenCalled();
    });

    test('should not redirect if the user removed is not the current user or the channel is not the current channel', () => {
        // Same channel, different user removed
        let msg = {
            data: {
                channel_id: currentChannelId,
                remover_id: otherUserId1,
            },
            broadcast: {
                user_id: otherUserId2,
            },
        };

        handleUserRemovedEvent(msg);
        expect(redirectUserToDefaultTeam).not.toHaveBeenCalled();

        // Different channel, current user removed
        msg = {
            data: {
                channel_id: otherChannelId,
                remover_id: otherUserId1,
            },
            broadcast: {
                user_id: currentUserId,
            },
        };

        handleUserRemovedEvent(msg);
        expect(redirectUserToDefaultTeam).not.toHaveBeenCalled();
    });
});

describe('handleNewPostEvent', () => {
    const initialState = {
        entities: {
            users: {
                currentUserId: 'user1',
                isManualStatus: {},
            },
        },
    };

    test('should receive post correctly', () => {
        const testStore = configureStore(initialState);

        const post = {id: 'post1', channel_id: 'channel1', user_id: 'user1'};
        const msg = {
            data: {
                post: JSON.stringify(post),
                set_online: true,
            },
        };

        testStore.dispatch(handleNewPostEvent(msg));
        expect(getProfilesAndStatusesForPosts).toHaveBeenCalledWith([post], expect.anything(), expect.anything());
        expect(handleNewPost).toHaveBeenCalledWith(post, msg);
    });

    test('should set other user to online', () => {
        const testStore = configureStore(initialState);

        const post = {id: 'post1', channel_id: 'channel1', user_id: 'user2'};
        const msg = {
            data: {
                post: JSON.stringify(post),
                set_online: true,
            },
        };

        testStore.dispatch(handleNewPostEvent(msg));

        expect(testStore.getActions()).toContainEqual({
            type: UserTypes.RECEIVED_STATUSES,
            data: [{user_id: post.user_id, status: UserStatuses.ONLINE}],
        });
    });

    test('should not set other user to online if post was from autoresponder', () => {
        const testStore = configureStore(initialState);

        const post = {id: 'post1', channel_id: 'channel1', user_id: 'user2', type: Constants.AUTO_RESPONDER};
        const msg = {
            data: {
                post: JSON.stringify(post),
                set_online: false,
            },
        };

        testStore.dispatch(handleNewPostEvent(msg));

        expect(testStore.getActions()).not.toContainEqual({
            type: UserTypes.RECEIVED_STATUSES,
            data: [{user_id: post.user_id, status: UserStatuses.ONLINE}],
        });
    });

    test('should not set other user to online if status was manually set', () => {
        const testStore = configureStore({
            ...initialState,
            entities: {
                ...initialState.entities,
                users: {
                    ...initialState.entities.users,
                    isManualStatus: {
                        user2: true,
                    },
                },
            },
        });

        const post = {id: 'post1', channel_id: 'channel1', user_id: 'user2'};
        const msg = {
            data: {
                post: JSON.stringify(post),
                set_online: true,
            },
        };

        testStore.dispatch(handleNewPostEvent(msg));

        expect(testStore.getActions()).not.toContainEqual({
            type: UserTypes.RECEIVED_STATUSES,
            data: [{user_id: post.user_id, status: UserStatuses.ONLINE}],
        });
    });

    test('should not set other user to online based on data from the server', () => {
        const testStore = configureStore(initialState);

        const post = {id: 'post1', channel_id: 'channel1', user_id: 'user2'};
        const msg = {
            data: {
                post: JSON.stringify(post),
                set_online: false,
            },
        };

        testStore.dispatch(handleNewPostEvent(msg));

        expect(testStore.getActions()).not.toContainEqual({
            type: UserTypes.RECEIVED_STATUSES,
            data: [{user_id: post.user_id, status: UserStatuses.ONLINE}],
        });
    });
});

describe('handleNewPostEvents', () => {
    const initialState = {
        entities: {
            general: {},
            preferences: {
                myPreferences: {},
            },
        },
    };

    test('should receive multiple posts correctly', () => {
        const testStore = configureStore(initialState);

        const posts = [
            {id: 'post1', channel_id: 'channel1'},
            {id: 'post2', channel_id: 'channel1'},
            {id: 'post3', channel_id: 'channel2'},
            {id: 'post4', channel_id: 'channel2'},
            {id: 'post5', channel_id: 'channel1'},
        ];

        const queue = posts.map((post) => {
            return {
                data: {post: JSON.stringify(post)},
            };
        });

        testStore.dispatch(handleNewPostEvents(queue));

        expect(testStore.getActions()).toEqual([
            {
                meta: {batch: true},
                payload: posts.map((post) => receivedNewPost(post, false)),
                type: 'BATCHING_REDUCER.BATCH',
            },
            {
                type: 'GET_THREADS_FOR_POSTS',
            },
        ]);
        expect(getThreadsForPosts).toHaveBeenCalledWith(posts);
        expect(getProfilesAndStatusesForPosts).toHaveBeenCalledWith(posts, expect.anything(), expect.anything());
    });
});

describe('reconnect', () => {
    test('should call syncPostsInChannel when socket reconnects', () => {
        reconnect();
        expect(syncPostsInChannel).toHaveBeenCalledWith('otherChannel', '12345');
    });
});

describe('handleChannelUpdatedEvent', () => {
    const initialState = {
        entities: {
            channels: {
                currentChannelId: 'channel',
            },
            teams: {
                currentTeamId: 'team',
                teams: {
                    team: {id: 'team', name: 'team'},
                },
            },
        },
    };

    test('when a channel is updated', () => {
        const testStore = configureStore(initialState);

        const channel = {id: 'channel'};
        const msg = {data: {channel: JSON.stringify(channel)}};

        testStore.dispatch(handleChannelUpdatedEvent(msg));

        expect(testStore.getActions()).toEqual([
            {type: ChannelTypes.RECEIVED_CHANNEL, data: channel},
        ]);
    });

    test('should not change URL when current channel is updated', () => {
        const testStore = configureStore(initialState);

        const channel = {id: 'channel'};
        const msg = {data: {channel: JSON.stringify(channel)}};

        testStore.dispatch(handleChannelUpdatedEvent(msg));

        expect(getHistory().replace).toHaveBeenCalled();
    });

    test('should not change URL when another channel is updated', () => {
        const testStore = configureStore(initialState);

        const channel = {id: 'otherchannel'};
        const msg = {data: {channel: JSON.stringify(channel)}};

        testStore.dispatch(handleChannelUpdatedEvent(msg));

        expect(getHistory().replace).not.toHaveBeenCalled();
    });
});

describe('handleCloudSubscriptionChanged', () => {
    const baseSubscription = {
        id: 'basesub',
        customer_id: '',
        product_id: '',
        add_ons: [],
        start_at: 0,
        end_at: 0,
        create_at: 0,
        seats: 0,
        trial_end_at: 0,
        is_free_trial: '',
    };

    test('when not cloud, does nothing', () => {
        const initialState = {
            entities: {
                cloud: {
                    limits: {
                        messages: {
                            history: 10000,
                        },
                        integrations: {
                            enabled: 10,
                        },
                    },
                },
                general: {
                    license: {
                        Cloud: 'false',
                    },
                },
            },
        };
        const newLimits = {
            messages: {
                history: 10001,
            },
        };

        const newSubscription = {
            ...baseSubscription,
            id: 'newsub',
        };
        const msg = {
            event: SocketEvents.CLOUD_PRODUCT_LIMITS_CHANGED,
            data: {
                limits: newLimits,
                subscription: newSubscription,
            },
        };

        const testStore = configureStore(initialState);
        testStore.dispatch(handleCloudSubscriptionChanged(msg));

        expect(testStore.getActions()).toEqual([]);
    });

    test('when on cloud, entirely replaces cloud limits in store', () => {
        const initialState = {
            entities: {
                cloud: {
                    limits: {
                        messages: {
                            history: 10000,
                        },
                        integrations: {
                            enabled: 10,
                        },
                    },
                },
                general: {
                    license: {
                        Cloud: 'true',
                    },
                },
            },
        };
        const newLimits = {
            messages: {
                history: 10001,
            },
        };
        const msg = {
            event: SocketEvents.CLOUD_PRODUCT_LIMITS_CHANGED,
            data: {
                limits: newLimits,
            },
        };

        const testStore = configureStore(initialState);
        testStore.dispatch(handleCloudSubscriptionChanged(msg));

        expect(testStore.getActions()).toContainEqual({
            type: CloudTypes.RECEIVED_CLOUD_LIMITS,
            data: newLimits,
        });
    });

    test('when on cloud, entirely replaces cloud limits in store', () => {
        const initialState = {
            entities: {
                cloud: {
                    subscription: {...baseSubscription},
                },
                general: {
                    license: {
                        Cloud: 'true',
                    },
                },
            },
        };
        const newSubscription = {
            ...baseSubscription,
            id: 'newsub',
        };

        const msg = {
            event: SocketEvents.CLOUD_PRODUCT_LIMITS_CHANGED,
            data: {
                subscription: newSubscription,
            },
        };

        const testStore = configureStore(initialState);
        testStore.dispatch(handleCloudSubscriptionChanged(msg));

        expect(testStore.getActions()).toContainEqual({
            type: CloudTypes.RECEIVED_CLOUD_SUBSCRIPTION,
            data: newSubscription,
        });
    });
});

describe('handlePluginEnabled/handlePluginDisabled', () => {
    const origLog = console.log;
    const origError = console.error;
    const origCreateElement = document.createElement;
    const origGetElementsByTagName = document.getElementsByTagName;
    const origWindowPlugins = window.plugins;

    afterEach(() => {
        console.log = origLog;
        console.error = origError;
        document.createElement = origCreateElement;
        document.getElementsByTagName = origGetElementsByTagName;
        window.plugins = origWindowPlugins;
    });

    describe('handlePluginEnabled', () => {
        const baseManifest = {
            name: 'Demo Plugin',
            description: 'This plugin demonstrates the capabilities of a Mattermost plugin.',
            version: '0.2.0',
            min_server_version: '5.12.0',
            server: {
                executables: {
                    'linux-amd64': 'server/dist/plugin-linux-amd64',
                    'darwin-amd64': 'server/dist/plugin-darwin-amd64',
                    'windows-amd64': 'server/dist/plugin-windows-amd64.exe',
                },
            },
            webapp: {
                bundle_path: 'webapp/dist/main.js',
            },
        };

        beforeEach(async () => {
            console.log = jest.fn();
            console.error = jest.fn();

            document.createElement = jest.fn();
            document.getElementsByTagName = jest.fn();
            document.getElementsByTagName.mockReturnValue([{
                appendChild: jest.fn(),
            }]);
        });

        test('when a plugin is enabled', () => {
            const manifest = {
                ...baseManifest,
                id: 'com.mattermost.demo-plugin',
            };
            const initialize = jest.fn();
            window.plugins = {
                [manifest.id]: {
                    initialize,
                },
            };

            const mockScript = {};
            document.createElement.mockReturnValue(mockScript);

            expect(mockScript.onload).toBeUndefined();
            handlePluginEnabled({data: {manifest}});

            expect(document.createElement).toHaveBeenCalledWith('script');
            expect(document.getElementsByTagName).toHaveBeenCalledTimes(1);
            expect(document.getElementsByTagName()[0].appendChild).toHaveBeenCalledTimes(1);
            expect(mockScript.onload).toBeInstanceOf(Function);

            // Pretend to be a browser, invoke onload
            mockScript.onload();
            expect(initialize).toHaveBeenCalledWith(expect.anything(), store);
            const registery = initialize.mock.calls[0][0];
            const mockComponent = 'mockRootComponent';
            registery.registerRootComponent(mockComponent);

            let dispatchArg = store.dispatch.mock.calls[0][0];
            expect(dispatchArg.type).toBe(ActionTypes.RECEIVED_WEBAPP_PLUGIN);
            expect(dispatchArg.data).toBe(manifest);

            dispatchArg = store.dispatch.mock.calls[1][0];

            expect(dispatchArg.type).toBe(ActionTypes.RECEIVED_PLUGIN_COMPONENT);
            expect(dispatchArg.name).toBe('Root');
            expect(dispatchArg.data.component).toBe(mockComponent);
            expect(dispatchArg.data.pluginId).toBe(manifest.id);

            expect(store.dispatch).toHaveBeenCalledTimes(2);

            // Assert handlePluginEnabled is idempotent
            mockScript.onload = undefined;
            handlePluginEnabled({data: {manifest}});
            expect(mockScript.onload).toBeUndefined();

            dispatchArg = store.dispatch.mock.calls[2][0];
            expect(dispatchArg.type).toBe(ActionTypes.RECEIVED_WEBAPP_PLUGIN);
            expect(dispatchArg.data).toBe(manifest);

            expect(store.dispatch).toHaveBeenCalledTimes(3);

            expect(console.error).toHaveBeenCalledTimes(0);
        });

        test('when a plugin is upgraded', () => {
            const manifest = {
                ...baseManifest,
                id: 'com.mattermost.demo-2-plugin',
            };
            const initialize = jest.fn();
            window.plugins = {
                [manifest.id]: {
                    initialize,
                },
            };

            const manifestv2 = {
                ...manifest,
                version: '0.2.1',
                webapp: {
                    bundle_path: 'webapp/dist/main2.0.js',
                },
            };

            const mockScript = {};
            document.createElement.mockReturnValue(mockScript);

            expect(mockScript.onload).toBeUndefined();
            handlePluginEnabled({data: {manifest}});

            expect(document.createElement).toHaveBeenCalledWith('script');
            expect(document.getElementsByTagName).toHaveBeenCalledTimes(1);
            expect(document.getElementsByTagName()[0].appendChild).toHaveBeenCalledTimes(1);
            expect(mockScript.onload).toBeInstanceOf(Function);

            // Pretend to be a browser, invoke onload
            mockScript.onload();
            expect(initialize).toHaveBeenCalledWith(expect.anything(), store);
            const registry = initialize.mock.calls[0][0];
            const mockComponent = 'mockRootComponent';
            registry.registerRootComponent(mockComponent);

            let dispatchArg = store.dispatch.mock.calls[0][0];
            expect(dispatchArg.type).toBe(ActionTypes.RECEIVED_WEBAPP_PLUGIN);
            expect(dispatchArg.data).toBe(manifest);

            dispatchArg = store.dispatch.mock.calls[1][0];
            expect(dispatchArg.type).toBe(ActionTypes.RECEIVED_PLUGIN_COMPONENT);
            expect(dispatchArg.name).toBe('Root');
            expect(dispatchArg.data.component).toBe(mockComponent);
            expect(dispatchArg.data.pluginId).toBe(manifest.id);

            // Upgrade plugin
            mockScript.onload = undefined;
            handlePluginEnabled({data: {manifest: manifestv2}});

            // Assert upgrade is idempotent
            handlePluginEnabled({data: {manifest: manifestv2}});

            expect(mockScript.onload).toBeInstanceOf(Function);
            expect(document.createElement).toHaveBeenCalledTimes(2);

            mockScript.onload();
            expect(initialize).toHaveBeenCalledWith(expect.anything(), store);
            expect(initialize).toHaveBeenCalledTimes(2);
            const registry2 = initialize.mock.calls[0][0];
            const mockComponent2 = 'mockRootComponent2';
            registry2.registerRootComponent(mockComponent2);

            dispatchArg = store.dispatch.mock.calls[2][0];
            expect(dispatchArg.type).toBe(ActionTypes.RECEIVED_WEBAPP_PLUGIN);
            expect(dispatchArg.data).toBe(manifestv2);

            expect(store.dispatch).toHaveBeenCalledTimes(6);
            const dispatchRemovedArg = store.dispatch.mock.calls[3][0];
            expect(typeof dispatchRemovedArg).toBe('function');
            dispatchRemovedArg(store.dispatch);

            dispatchArg = store.dispatch.mock.calls[4][0];
            expect(dispatchArg.type).toBe(ActionTypes.RECEIVED_WEBAPP_PLUGIN);
            expect(dispatchArg.data).toBe(manifestv2);

            const dispatchReceivedArg2 = store.dispatch.mock.calls[5][0];
            expect(dispatchReceivedArg2.type).toBe(ActionTypes.RECEIVED_PLUGIN_COMPONENT);
            expect(dispatchReceivedArg2.name).toBe('Root');
            expect(dispatchReceivedArg2.data.component).toBe(mockComponent2);
            expect(dispatchReceivedArg2.data.pluginId).toBe(manifest.id);

            expect(store.dispatch).toHaveBeenCalledTimes(8);
            const dispatchReceivedArg4 = store.dispatch.mock.calls[7][0];

            expect(dispatchReceivedArg4.type).toBe(ActionTypes.REMOVED_WEBAPP_PLUGIN);
            expect(dispatchReceivedArg4.data).toBe(manifestv2);

            expect(console.error).toHaveBeenCalledTimes(0);
        });
    });

    describe('handlePluginDisabled', () => {
        const baseManifest = {
            name: 'Demo Plugin',
            description: 'This plugin demonstrates the capabilities of a Mattermost plugin.',
            version: '0.2.0',
            min_server_version: '5.12.0',
            server: {
                executables: {
                    'linux-amd64': 'server/dist/plugin-linux-amd64',
                    'darwin-amd64': 'server/dist/plugin-darwin-amd64',
                    'windows-amd64': 'server/dist/plugin-windows-amd64.exe',
                },
            },
            webapp: {
                bundle_path: 'webapp/dist/main.js',
            },
        };

        beforeEach(async () => {
            console.log = jest.fn();
            console.error = jest.fn();

            document.createElement = jest.fn();
            document.getElementsByTagName = jest.fn();
            document.getElementsByTagName.mockReturnValue([{
                appendChild: jest.fn(),
            }]);
        });

        test('when a plugin is disabled', () => {
            const manifest = {
                ...baseManifest,
                id: 'com.mattermost.demo-3-plugin',
            };
            const initialize = jest.fn();
            window.plugins = {
                [manifest.id]: {
                    initialize,
                },
            };

            const mockScript = {};
            document.createElement.mockReturnValue(mockScript);

            expect(mockScript.onload).toBeUndefined();

            // Enable plugin
            handlePluginEnabled({data: {manifest}});

            expect(document.createElement).toHaveBeenCalledWith('script');
            expect(document.createElement).toHaveBeenCalledTimes(1);

            // Disable plugin
            handlePluginDisabled({data: {manifest}});

            // Assert handlePluginDisabled is idempotent
            handlePluginDisabled({data: {manifest}});

            expect(store.dispatch).toHaveBeenCalledTimes(3);

            const dispatchArg = store.dispatch.mock.calls[0][0];
            expect(dispatchArg.type).toBe(ActionTypes.RECEIVED_WEBAPP_PLUGIN);
            expect(dispatchArg.data).toBe(manifest);

            const dispatchRemovedArg = store.dispatch.mock.calls[1][0];

            expect(typeof dispatchRemovedArg).toBe('function');
            dispatchRemovedArg(store.dispatch);

            expect(store.dispatch).toHaveBeenCalledTimes(5);
            const dispatchReceivedArg3 = store.dispatch.mock.calls[4][0];
            expect(dispatchReceivedArg3.type).toBe(ActionTypes.REMOVED_WEBAPP_PLUGIN);
            expect(dispatchReceivedArg3.data).toBe(manifest);

            expect(console.error).toHaveBeenCalledTimes(0);
        });
    });
});

describe('handleAppsPluginEnabled', () => {
    test('plugin enabled action is dispatched', async () => {
        const enableAction = handleAppsPluginEnabled();
        expect(enableAction).toEqual({type: 'APPS_PLUGIN_ENABLED'});
    });
});

describe('handleAppsPluginDisabled', () => {
    test('plugin disabled action is dispatched', async () => {
        const disableAction = handleAppsPluginDisabled();
        expect(disableAction).toEqual({type: 'APPS_PLUGIN_DISABLED'});
    });
});

describe('handleLeaveTeam', () => {
    test('when a user leave a team', () => {
        const msg = {data: {team_id: 'team', user_id: 'member1'}};

        handleLeaveTeamEvent(msg);

        const expectedAction = {
            meta: {
                batch: true,
            },
            payload: [
                {
                    data: {id: 'team', user_id: 'member1'},
                    type: 'RECEIVED_PROFILE_NOT_IN_TEAM',
                },
                {
                    data: {team_id: 'team', user_id: 'member1'},
                    type: 'REMOVE_MEMBER_FROM_TEAM',
                },
                {
                    data: {id: 'channel1', user_id: 'member1'},
                    type: 'REMOVE_MEMBER_FROM_CHANNEL',
                },
                {
                    data: {id: 'channel2', user_id: 'member1'},
                    type: 'REMOVE_MEMBER_FROM_CHANNEL',
                },
            ],
            type: 'BATCHING_REDUCER.BATCH',
        };
        expect(store.dispatch).toHaveBeenCalledWith(expectedAction);
    });
});
