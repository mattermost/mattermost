// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import testConfigureStore from 'tests/test_store';

import {getHistory} from 'utils/browser_history';
import Constants, {NotificationLevels, UserStatuses} from 'utils/constants';
import * as NotificationSounds from 'utils/notification_sounds';
import * as utils from 'utils/notifications';

import {sendDesktopNotification} from './notification_actions';

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
            spy = jest.spyOn(utils, 'showNotification');
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
                            },
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
                                team_id: 'team_id',
                            },
                            another_channel_id: {
                                id: 'another_channel_id',
                                team_id: 'team_id',
                            },
                        },
                        myMembers: {
                            channel_id: {
                                id: 'current_user_id',
                                notify_props: channelSettings,
                            },
                        },
                        membersInChannel: {
                            channel_id: {
                                current_user_id: {
                                    id: 'current_user_id',
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
                    silent: true,
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
                        silent: true,
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
    });
});
