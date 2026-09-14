// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelMembership, ChannelNotifyProps, ChannelType} from '@mattermost/types/channels';
import type {Post, PostType} from '@mattermost/types/posts';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserNotifyProps, UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {MarkUnread} from 'mattermost-redux/constants/channels';

import testConfigureStore from 'tests/test_store';
import {getHistory} from 'utils/browser_history';
import Constants, {NotificationLevels, UserStatuses} from 'utils/constants';
import * as NotificationSounds from 'utils/notification_sounds';
import * as utils from 'utils/notifications';
import {getFocusedPopoutInfo} from 'utils/popouts/focus';

import type {GlobalState} from 'types/store';

import type {NewPostMessageProps} from './new_post';
import {sendDesktopNotification, isDesktopSoundEnabled, getDesktopNotificationSound} from './notification_actions';

jest.mock('utils/popouts/focus', () => ({
    getFocusedPopoutInfo: jest.fn(() => null),
}));

describe('notification_actions', () => {
    describe('sendDesktopNotification', () => {
        let baseState: GlobalState;
        let channelSettings: Partial<ChannelNotifyProps>;
        let crt: Partial<PreferenceType>;
        let msgProps: NewPostMessageProps;
        let post: Post;
        let spy: jest.SpyInstance<ReturnType<typeof utils.showNotification>, Parameters<typeof utils.showNotification>>;
        let userSettings: Partial<UserNotifyProps>;

        beforeEach(() => {
            spy = jest.spyOn(utils, 'showNotification').mockReturnValue((async () => ({status: 'success'})) as unknown as ReturnType<typeof utils.showNotification>);
            (NotificationSounds as {ding: typeof NotificationSounds.ding}).ding = jest.fn();

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
            } as unknown as Partial<UserNotifyProps>;

            post = {
                id: 'post_id',
                user_id: 'user_id',
                root_id: 'root_id',
                channel_id: 'channel_id',
                props: {from_webhook: false},
                message: 'Where is Jessica Hyde?',
            } as unknown as Post;

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
            } as unknown as GlobalState;
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
                    tag: 'post_id',
                    title: 'Utopia',
                    onClick: expect.any(Function),
                });

                (spy.mock.calls[0][0]!.onClick as () => void)();

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
            msgProps.channel_type = Constants.DM_CHANNEL as ChannelType;

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
            post.type = 'system_message' as PostType;
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).not.toHaveBeenCalled();
            });
        });

        test('should not notify user on silent_notification post', () => {
            const store = testConfigureStore(baseState);
            post.props.silent_notification = true;
            return store.dispatch(sendDesktopNotification(post, msgProps)).then((result) => {
                expect(spy).not.toHaveBeenCalled();
                expect(result).toEqual({data: {status: 'not_sent', reason: 'silent_notification'}});
            });
        });

        test('should notify for silent_notification post when force_notification overrides', () => {
            const store = testConfigureStore(baseState);
            post.props.silent_notification = true;
            post.props.force_notification = 'abc123';
            return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                expect(spy).toHaveBeenCalled();
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
                    tag: 'post_id',
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
                        tag: 'post_id',
                        title: 'Reply in Utopia',
                        onClick: expect.any(Function),
                    });
                    (spy.mock.calls[0][0]!.onClick as () => void)();

                    expect(getHistory().push).toHaveBeenCalledWith('/team/pl/post_id');
                    expect(window.focus).toHaveBeenCalled();
                    window.focus = focus;
                });
            });
        });

        describe('popout windows', () => {
            afterEach(() => {
                jest.mocked(getFocusedPopoutInfo).mockReturnValue(null);
            });

            test('should not notify when the channel is focused in a popout window', () => {
                baseState.views.browser.focused = false;
                jest.mocked(getFocusedPopoutInfo).mockReturnValue({channelId: 'channel_id'});

                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).not.toHaveBeenCalled();
                });
            });

            test('should notify when the popout is focused on a different channel', () => {
                baseState.views.browser.focused = false;
                jest.mocked(getFocusedPopoutInfo).mockReturnValue({channelId: 'other_channel_id'});

                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
                });
            });

            test('should not notify when a CRT thread is focused in a popout window', () => {
                crt.value = 'on';
                baseState.views.browser.focused = false;
                jest.mocked(getFocusedPopoutInfo).mockReturnValue({channelId: 'channel_id', threadId: 'root_id'});
                msgProps.mentions = JSON.stringify(['current_user_id']);
                msgProps.followers = JSON.stringify(['current_user_id']);

                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).not.toHaveBeenCalled();
                });
            });

            test('should notify when the thread popout is focused on a different thread', () => {
                crt.value = 'on';
                baseState.views.browser.focused = false;
                jest.mocked(getFocusedPopoutInfo).mockReturnValue({channelId: 'channel_id', threadId: 'other_thread_id'});
                msgProps.mentions = JSON.stringify(['current_user_id']);
                msgProps.followers = JSON.stringify(['current_user_id']);

                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
                });
            });

            test('should not suppress notification when a thread popout is focused but post is a channel message', () => {
                baseState.views.browser.focused = false;
                jest.mocked(getFocusedPopoutInfo).mockReturnValue({channelId: 'channel_id', threadId: 'some_thread_id'});

                const store = testConfigureStore(baseState);
                return store.dispatch(sendDesktopNotification(post, msgProps)).then(() => {
                    expect(spy).toHaveBeenCalled();
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

// Identity helpers so each fixture below is checked against the real notify prop unions instead of
// being cast blindly. Fixtures holding values outside those unions (empty strings) are stale and keep
// their unchecked casts.
function makeChannelMember(channelMember: DeepPartial<ChannelMembership>): ChannelMembership {
    return channelMember as ChannelMembership;
}

function makeUser(user: DeepPartial<UserProfile>): UserProfile {
    return user as UserProfile;
}

describe('isDesktopSoundEnabled', () => {
    test('should return channel member sound if it exists', () => {
        const channelMember1 = makeChannelMember({
            notify_props: {
                desktop_sound: 'on',
            },
        });
        const user1 = makeUser({
            notify_props: {
                desktop_sound: 'false',
            },
        });
        expect(isDesktopSoundEnabled(channelMember1, user1)).toBe(true);

        const channelMember2 = makeChannelMember({
            notify_props: {
                desktop_sound: 'off',
            },
        });
        const user2 = makeUser({
            notify_props: {
                desktop_sound: 'false',
            },
        });
        expect(isDesktopSoundEnabled(channelMember2, user2)).toBe(false);

        const channelMember3 = makeChannelMember({
            notify_props: {
                desktop_sound: 'default',
            },
        });
        const user3 = makeUser({
            notify_props: {
                desktop_sound: 'false',
            },
        });
        expect(isDesktopSoundEnabled(channelMember3, user3)).toBe(false);

        const channelMember4 = makeChannelMember({
            notify_props: {
                desktop_sound: 'default',
            },
        });
        const user4 = makeUser({
            notify_props: {
                desktop_sound: 'true',
            },
        });
        expect(isDesktopSoundEnabled(channelMember4, user4)).toBe(true);

        const channelMember5 = makeChannelMember({
            notify_props: {
                desktop_sound: 'on',
            },
        });
        const user5 = {
            notify_props: {
                desktop_sound: '',
            },
        } as unknown as UserProfile;
        expect(isDesktopSoundEnabled(channelMember5, user5)).toBe(true);
    });

    test('should return user sound if channel member sound is not defined', () => {
        const channelMember1 = {
            notify_props: {
                desktop_sound: '',
            },
        } as unknown as ChannelMembership;
        const user1 = makeUser({
            notify_props: {
                desktop_sound: 'true',
            },
        });
        expect(isDesktopSoundEnabled(channelMember1, user1)).toBe(true);

        const channelMember2 = {
            notify_props: {
                desktop_sound: '',
            },
        } as unknown as ChannelMembership;
        const user2 = makeUser({
            notify_props: {
                desktop_sound: 'false',
            },
        });
        expect(isDesktopSoundEnabled(channelMember2, user2)).toBe(false);

        const channelMember3 = makeChannelMember({
            notify_props: {},
        });
        const user3 = makeUser({
            notify_props: {
                desktop_sound: 'false',
            },
        });
        expect(isDesktopSoundEnabled(channelMember3, user3)).toBe(false);
    });

    test('should return default if both channel member and user are not defined', () => {
        const channelMember = makeChannelMember({});
        const user = makeUser({});
        expect(isDesktopSoundEnabled(channelMember, user)).toBe(true);
    });
});

describe('getDesktopNotificationSound', () => {
    test('should return channel member notification sound if it exists', () => {
        const channelMember1 = makeChannelMember({
            notify_props: {
                desktop_notification_sound: 'default',
            },
        });
        const user1 = makeUser({
            notify_props: {
                desktop_notification_sound: 'Crackle',
            },
        });
        expect(getDesktopNotificationSound(channelMember1, user1)).toBe('Crackle');

        const channelMember2 = makeChannelMember({
            notify_props: {
                desktop_notification_sound: 'default',
            },
        });
        const user2 = {
            notify_props: {
                desktop_notification_sound: '',
            },
        } as unknown as UserProfile;
        expect(getDesktopNotificationSound(channelMember2, user2)).toBe('Bing');

        const channelMember3 = makeChannelMember({
            notify_props: {
                desktop_notification_sound: 'Crackle',
            },
        });
        const user3 = makeUser({
            notify_props: {
                desktop_notification_sound: 'Bing',
            },
        });
        expect(getDesktopNotificationSound(channelMember3, user3)).toBe('Crackle');
    });

    test('should return user notification sound if channel member sound is not defined', () => {
        const channelMember1 = makeChannelMember({});
        const user1 = makeUser({
            notify_props: {
                desktop_notification_sound: 'Crackle',
            },
        });
        expect(getDesktopNotificationSound(channelMember1, user1)).toBe('Crackle');

        const channelMember2 = makeChannelMember({});
        const user2 = makeUser({});
        expect(getDesktopNotificationSound(channelMember2, user2)).toBe('Bing');
    });
});
