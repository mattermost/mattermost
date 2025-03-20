// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {MarkUnread} from 'mattermost-redux/constants/channels';

import testConfigureStore from 'tests/test_store';
import {getHistory} from 'utils/browser_history';
import Constants, {NotificationLevels, UserStatuses} from 'utils/constants';
import * as NotificationSounds from 'utils/notification_sounds';
import * as utils from 'utils/notifications';

import {sendDesktopNotification, isDesktopSoundEnabled, getDesktopNotificationSound} from './notification_actions';

describe('notification_actions', () => {
    describe('sendDesktopNotification', () => {
        let baseState;
        let channelSettings;
        let crt;
        let msgProps;
        let post;
        let spy;
        let userSettings;

        beforeEach(() => {
            spy = jest.spyOn(utils, 'showNotification').mockReturnValue(async () => ({status: 'success'}));
            NotificationSounds.ding = jest.fn();

            crt = {
                user_id: 'current_user_id',
                value: 'off',
            };

            channelSettings = {
                desktop: NotificationLevels.ALL,
            };

            userSettings = {
                desktop: NotificationLevels.ALL,
                desktop_sound: false,
                desktop_threads: NotificationLevels.ALL,
                mention_keys: 'mentionkey',
                first_name: 'true',
                channel: 'true',
            };

            post = {
                id: 'post_id',
                user_id: 'user_id',
                root_id: 'root_id',
                channel_id: 'channel_id',
                props: {from_webhook: false},
                message: 'Where is Jessica Hyde?',
            };

            msgProps = {
                post: JSON.stringify(post),
                channel_display_name: 'Utopia',
                team_id: 'team_id',
            };

            baseState = {
                entities: {
                    general: {
                        config: {
                            CollapsedThreads: 'default_off',
                        },
                    },
                    threads: {
                        threads: {},
                    },
                    users: {
                        statuses: {
                            current_user_id: 'online',
                        },
                        isManualStatus: {
                            current_user_id: false,
                        },
                        currentUserId: 'current_user_id',
                        profiles: {
                            user_id: {
                                id: 'user_id',
                                username: 'username',
                            },
                            current_user_id: {
                                id: 'current_user_id',
                                notify_props: userSettings,
                                username: 'currentusername',
                                first_name: 'currentuserfirstname',
                            },
                        },
                        profilesInChannel: {
                            gm_channel: new Set(['current_user_id']),
                        },
                    },
                    teams: {
                        currentTeamId: 'team_id',
                        teams: {
                            team_id: {
                                id: 'team_id',
                                name: 'team',
                            },
                        },
                        myMembers: {},
                    },
                    channels: {
                        currentChannelId: 'channel_id',
                        channels: {
                            channel_id: {
                                id: 'channel_id',
                                team_id: 'team_id',
                                display_name: 'Utopia',
                                name: 'utopia',
                            },
                            muted_channel_id: {
                                id: 'muted_channel_id',
                                display_name: 'Muted Channel',
                                team_id: 'team_id',
                            },
                            another_channel_id: {
                                id: 'another_channel_id',
                                team_id: 'team_id',
                            },
                            gm_channel: {
                                id: 'gm_channel',
                                type: 'G',
                            },
                        },
                        myMembers: {
                            channel_id: {
                                id: 'current_user_id',
                                notify_props: channelSettings,
                            },
                            gm_channel: {
                                id: 'gm_channel',
                                notify_props: channelSettings,
                            },
                            muted_channel_id: {
                                id: 'muted_channel_id',
                                team_id: 'team_id',
                                notify_props: {
                                    mark_unread: MarkUnread.MENTION,
                                },
                            },
                        },
                        membersInChannel: {
                            channel_id: {
                                current_user_id: {
                                    id: 'current_user_id',
                                    notify_props: channelSettings,
                                },
                            },
                            gm_channel: {
                                current_user_id: {
                                    id: 'gm_channel',
                                    notify_props: channelSettings,
                                },
                            },
                            muted_channel_id: {
                                current_user_id: {
                                    id: 'current_user_id',
                                    notify_props: {
                                        mark_unread: NotificationLevels.MENTION,
                                    },
                                },
                            },
                        },
                    },
                    preferences: {
                        myPreferences: {
                            'display_settings--collapsed_reply_threads': crt,
                        },
                    },
                    groups: {
                        groups: {},
                        myGroups: [],
                    },
                },
                views: {
                    browser: {
                        focused: false,
                    },
                    threads: {
                        selectedThreadIdInTeam: {
                            team_id: 'another_root_id',
                        },
                    },
                    rhs: {
                        isSidebarOpen: true,
                    },
                },
                plugins: {
                    components: {
                        DesktopNotificationHooks: [],
                    },
                },
            };
        });

        test('should notify user', async () => {
            const store = testConfigureStore(baseState);
            const focus = window.focus;
            window.focus = jest.fn();

            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).toHaveBeenCalledWith({
                    body: '@username: Where is Jessica Hyde?',
                    requireInteraction: false,
                    silent: false,
                    title: 'Utopia',
                    onClick: expect.any(Function),
                });

                spy.mock.calls[0][0].onClick();

                expect(getHistory().push).toHaveBeenCalledWith('/team/channels/utopia');
                expect(window.focus).toHaveBeenCalled();
                window.focus = focus;
            });
        });

        test('should not notify user when tab and channel are active', async () => {
            const store = testConfigureStore(baseState);
            baseState.views.browser.focused = true;

            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should notify user when tab is active but the channel is not', async () => {
            const store = testConfigureStore(baseState);
            baseState.views.browser.focused = true;
            baseState.entities.channels.currentChannelId = 'another_channel_id';

            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).toHaveBeenCalled();
            });
        });

        test('should not notify user when notify props is set to mention and there are no mentions', async () => {
            channelSettings.desktop = NotificationLevels.MENTION;
            const store = testConfigureStore(baseState);

            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should not notify user when notify props is set to NONE', async () => {
            userSettings.desktop = NotificationLevels.ALL;
            channelSettings.desktop = NotificationLevels.NONE;
            const store = testConfigureStore(baseState);

            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should not notify user when notify props is set to NONE', async () => {
            userSettings.desktop = NotificationLevels.NONE;
            channelSettings.desktop = undefined;
            const store = testConfigureStore(baseState);

            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should notify user when notify props is set to mention and there are no mentions but it\'s a DM_CHANNEL', () => {
            userSettings.desktop = NotificationLevels.MENTION;
            msgProps.channel_type = Constants.DM_CHANNEL;

            const store = testConfigureStore(baseState);
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).toHaveBeenCalled();
            });
        });

        test('should notify user when notify props is set to mention and there are mentions', async () => {
            channelSettings.desktop = NotificationLevels.MENTION;
            msgProps.mentions = JSON.stringify(['current_user_id']);

            const store = testConfigureStore(baseState);

            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).toHaveBeenCalled();
            });
        });

        test('should not notify user on user\'s webhook', async () => {
            const store = testConfigureStore(baseState);
            post.props.from_webhook = true;
            post.user_id = 'current_user_id';

            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should not notify user on systemMessage', () => {
            const store = testConfigureStore(baseState);
            post.type = 'system_message';
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should notify user on add to channel', () => {
            const store = testConfigureStore(baseState);
            post.type = 'system_add_to_channel';
            post.props.addedUserId = 'current_user_id';
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).toHaveBeenCalled();
            });
        });

        test('should not notify user on other user add to channel', () => {
            const store = testConfigureStore(baseState);
            post.type = 'system_add_to_channel';
            post.props.addedUserId = 'not_current_user_id';
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should not notify user on muted channels', () => {
            const store = testConfigureStore(baseState);
            post.channel_id = 'muted_channel_id';
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should notify for forced notification posts on muted channels', () => {
            const store = testConfigureStore(baseState);
            const newPost = {
                ...post,
                props: {
                    ...post.props,
                    force_notification: 'test',
                },
            };
            newPost.channel_id = 'muted_channel_id';

            const newMsgProps = {
                post: JSON.stringify(newPost),
                channel_display_name: 'Muted Channel',
                team_id: 'team_id',
            };
            return store.dispatch(sendDesktopNotification(newPost, newMsgProps)).then((result) => {
                expect(result).toEqual({data: {status: 'success'}});
                expect(spy).toHaveBeenCalledWith({
                    body: '@username: Where is Jessica Hyde?',
                    requireInteraction: false,
                    silent: false,
                    title: 'Muted Channel',
                    onClick: expect.any(Function),
                });
            });
        });

        test.each([
            UserStatuses.DND,
            UserStatuses.OUT_OF_OFFICE,
        ])('should not notify user on user status %s', (status) => {
            baseState.entities.users.statuses.current_user_id = status;
            const store = testConfigureStore(baseState);
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test.each([
            UserStatuses.OFFLINE,
            UserStatuses.AWAY,
            UserStatuses.ONLINE,
        ])('should notify user on user status %s', (status) => {
            baseState.entities.users.statuses.current_user_id = status;
            const store = testConfigureStore(baseState);
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).toHaveBeenCalled();
            });
        });

        test('should default sound when no sound is specified', () => {
            const dingSpy = jest.spyOn(NotificationSounds, 'ding');
            baseState.entities.users.profiles.current_user_id.notify_props.desktop_sound = 'true';
            const store = testConfigureStore(baseState);
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(dingSpy).toHaveBeenCalledWith('Bing');
            });
        });

        test('should use specified sound when specified', () => {
            const dingSpy = jest.spyOn(NotificationSounds, 'ding');
            baseState.entities.users.profiles.current_user_id.notify_props.desktop_sound = 'true';
            baseState.entities.users.profiles.current_user_id.notify_props.desktop_notification_sound = 'Crackle';
            const store = testConfigureStore(baseState);
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(dingSpy).toHaveBeenCalledWith('Crackle');
            });
        });

        describe('CollapsedThreads: false', () => {
            beforeEach(() => {
                crt.value = 'off';
            });

            test('should notify user on replies regardless of them being followed', () => {
                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
                });
            });
        });

        describe('CollapsedThreads: true', () => {
            beforeEach(() => {
                crt.value = 'on';
            });

            test('should not notify user on crt reply when the tab is active and the thread is open', () => {
                baseState.views.threads.selectedThreadIdInTeam.team_id = 'root_id';
                baseState.views.browser.focused = true;
                msgProps.mentions = JSON.stringify(['current_user_id']);

                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).not.toHaveBeenCalled();
                });
            });

            test('should not notify user on crt reply when desktop is MENTION and there is no mention', () => {
                userSettings.desktop = NotificationLevels.MENTION;

                msgProps.mentions = JSON.stringify([]);

                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).not.toHaveBeenCalled();
                });
            });

            test('should redirect to permalink when CRT in on and the post is a thread', () => {
                const focus = window.focus;
                window.focus = jest.fn();

                userSettings.desktop = NotificationLevels.MENTION;
                msgProps.followers = JSON.stringify(['current_user_id']);

                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalledWith({
                        body: '@username: Where is Jessica Hyde?',
                        requireInteraction: false,
                        silent: false,
                        title: 'Reply in Utopia',
                        onClick: expect.any(Function),
                    });
                    spy.mock.calls[0][0].onClick();

                    expect(getHistory().push).toHaveBeenCalledWith('/team/pl/post_id');
                    expect(window.focus).toHaveBeenCalled();
                    window.focus = focus;
                });
            });
        });

        describe('GMs', () => {
            test('should notify for any message when channel setting is DEFAULT and user setting is MENTION', async () => {
                const store = testConfigureStore(baseState);
                userSettings.desktop = NotificationLevels.MENTION;
                channelSettings.desktop = NotificationLevels.DEFAULT;
                post.channel_id = 'gm_channel';
                msgProps.team_id = '';

                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
                });
            });
            test('should not notify for any message when channel setting is DEFAULT and user setting is NONE', async () => {
                const store = testConfigureStore(baseState);
                userSettings.desktop = NotificationLevels.NONE;
                channelSettings.desktop = NotificationLevels.DEFAULT;
                post.message = '@username';
                post.channel_id = 'gm_channel';
                msgProps.team_id = '';

                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).not.toHaveBeenCalled();
                });
            });
            test('should notify when channel setting MENTION and there is a explicit mention', async () => {
                const store = testConfigureStore(baseState);
                channelSettings.desktop = NotificationLevels.MENTION;
                post.message = '@currentusername';
                post.channel_id = 'gm_channel';
                msgProps.team_id = '';

                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
                });
            });
            test('should notify when channel setting MENTION and there is a keyword mention', async () => {
                const store = testConfigureStore(baseState);
                channelSettings.desktop = NotificationLevels.MENTION;
                post.message = 'mentionkey';
                post.channel_id = 'gm_channel';
                msgProps.team_id = '';

                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
                });
            });
            test('should notify when channel setting MENTION and there is the first name', async () => {
                const store = testConfigureStore(baseState);
                channelSettings.desktop = NotificationLevels.MENTION;
                post.message = 'currentuserfirstname';
                post.channel_id = 'gm_channel';
                msgProps.team_id = '';

                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
                });
            });
            test('should notify when channel setting MENTION and there is a channel mention', async () => {
                const store = testConfigureStore(baseState);
                channelSettings.desktop = NotificationLevels.MENTION;
                post.message = '@all';
                post.channel_id = 'gm_channel';
                msgProps.team_id = '';

                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
                });
            });
            test('should not notify when channel setting MENTION and there is no explicit mention', async () => {
                const store = testConfigureStore(baseState);
                channelSettings.desktop = NotificationLevels.MENTION;
                post.channel_id = 'gm_channel';
                msgProps.team_id = '';

                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).not.toHaveBeenCalled();
                });
            });
        });
    });
});

describe('isDesktopSoundEnabled', () => {
    test('should return channel member sound if it exists', () => {
        const channelMember1 = {
            notify_props: {
                desktop_sound: 'on',
            },
        };
        const user1 = {
            notify_props: {
                desktop_sound: 'false',
            },
        };
        expect(isDesktopSoundEnabled(channelMember1, user1)).toBe(true);

        const channelMember2 = {
            notify_props: {
                desktop_sound: 'off',
            },
        };
        const user2 = {
            notify_props: {
                desktop_sound: 'false',
            },
        };
        expect(isDesktopSoundEnabled(channelMember2, user2)).toBe(false);

        const channelMember3 = {
            notify_props: {
                desktop_sound: 'default',
            },
        };
        const user3 = {
            notify_props: {
                desktop_sound: 'false',
            },
        };
        expect(isDesktopSoundEnabled(channelMember3, user3)).toBe(false);

        const channelMember4 = {
            notify_props: {
                desktop_sound: 'default',
            },
        };
        const user4 = {
            notify_props: {
                desktop_sound: 'true',
            },
        };
        expect(isDesktopSoundEnabled(channelMember4, user4)).toBe(true);

        const channelMember5 = {
            notify_props: {
                desktop_sound: 'on',
            },
        };
        const user5 = {
            notify_props: {
                desktop_sound: '',
            },
        };
        expect(isDesktopSoundEnabled(channelMember5, user5)).toBe(true);
    });

    test('should return user sound if channel member sound is not defined', () => {
        const channelMember1 = {
            notify_props: {
                desktop_sound: '',
            },
        };
        const user1 = {
            notify_props: {
                desktop_sound: 'true',
            },
        };
        expect(isDesktopSoundEnabled(channelMember1, user1)).toBe(true);

        const channelMember2 = {
            notify_props: {
                desktop_sound: '',
            },
        };
        const user2 = {
            notify_props: {
                desktop_sound: 'false',
            },
        };
        expect(isDesktopSoundEnabled(channelMember2, user2)).toBe(false);

        const channelMember3 = {
            notify_props: {},
        };
        const user3 = {
            notify_props: {
                desktop_sound: 'false',
            },
        };
        expect(isDesktopSoundEnabled(channelMember3, user3)).toBe(false);
    });

    test('should return default if both channel member and user are not defined', () => {
        const channelMember = {};
        const user = {};
        expect(isDesktopSoundEnabled(channelMember, user)).toBe(true);
    });
});

describe('getDesktopNotificationSound', () => {
    test('should return channel member notification sound if it exists', () => {
        const channelMember1 = {
            notify_props: {
                desktop_notification_sound: 'default',
            },
        };
        const user1 = {
            notify_props: {
                desktop_notification_sound: 'Crackle',
            },
        };
        expect(getDesktopNotificationSound(channelMember1, user1)).toBe('Crackle');

        const channelMember2 = {
            notify_props: {
                desktop_notification_sound: 'default',
            },
        };
        const user2 = {
            notify_props: {
                desktop_notification_sound: '',
            },
        };
        expect(getDesktopNotificationSound(channelMember2, user2)).toBe('Bing');

        const channelMember3 = {
            notify_props: {
                desktop_notification_sound: 'Crackle',
            },
        };
        const user3 = {
            notify_props: {
                desktop_notification_sound: 'Bing',
            },
        };
        expect(getDesktopNotificationSound(channelMember3, user3)).toBe('Crackle');
    });

    test('should return user notification sound if channel member sound is not defined', () => {
        const channelMember1 = {};
        const user1 = {
            notify_props: {
                desktop_notification_sound: 'Crackle',
            },
        };
        expect(getDesktopNotificationSound(channelMember1, user1)).toBe('Crackle');

        const channelMember2 = {};
        const user2 = {};
        expect(getDesktopNotificationSound(channelMember2, user2)).toBe('Bing');
    });
});
