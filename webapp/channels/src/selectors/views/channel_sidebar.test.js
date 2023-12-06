// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Preferences} from 'mattermost-redux/constants';
import mergeObjects from 'mattermost-redux/test/merge_objects';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {TestHelper} from 'utils/test_helper';

import * as Selectors from './channel_sidebar';

describe('isUnreadFilterEnabled', () => {
    const preferenceKey = getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION);

    const baseState = {
        entities: {
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {
                    [preferenceKey]: {value: 'false'},
                },
            },
        },
        views: {
            channelSidebar: {
                unreadFilterEnabled: false,
            },
        },
    };

    test('should return false when filter is disabled', () => {
        const state = baseState;

        expect(Selectors.isUnreadFilterEnabled(state)).toBe(false);
    });

    test('should return true when filter is enabled and unreads aren\'t separate', () => {
        const state = mergeObjects(baseState, {
            views: {
                channelSidebar: {
                    unreadFilterEnabled: true,
                },
            },
        });

        expect(Selectors.isUnreadFilterEnabled(state)).toBe(true);
    });

    test('should return false when unreads are separate', () => {
        const state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: {
                        [preferenceKey]: {value: 'true'},
                    },
                },
            },
            views: {
                channelSidebar: {
                    unreadFilterEnabled: true,
                },
            },
        });

        expect(Selectors.isUnreadFilterEnabled(state)).toBe(false);
    });
});

describe('getUnreadChannels', () => {
    const currentChannel = TestHelper.getChannelMock({id: 'currentChannel', delete_at: 0, last_post_at: 0});
    const readChannel = {id: 'readChannel', delete_at: 0, last_post_at: 300};
    const unreadChannel1 = {id: 'unreadChannel1', delete_at: 0, last_post_at: 100};
    const unreadChannel2 = {id: 'unreadChannel2', delete_at: 0, last_post_at: 200};

    const baseState = {
        entities: {
            channels: {
                channels: {
                    currentChannel,
                    readChannel,
                    unreadChannel1,
                    unreadChannel2,
                },
                channelsInTeam: {
                    team1: ['unreadChannel1', 'unreadChannel2', 'readChannel'],
                },
                currentChannelId: 'currentChannel',
                messageCounts: {
                    currentChannel: {total: 0},
                    readChannel: {total: 10},
                    unreadChannel1: {total: 10},
                    unreadChannel2: {total: 10},
                },
                myMembers: {
                    currentChannel: {notify_props: {}, mention_count: 0, msg_count: 0},
                    readChannel: {notify_props: {}, mention_count: 0, msg_count: 10},
                    unreadChannel1: {notify_props: {}, mention_count: 0, msg_count: 8},
                    unreadChannel2: {notify_props: {}, mention_count: 0, msg_count: 8},
                },
            },
            posts: {
                postsInChannel: {},
            },
            teams: {
                currentTeamId: 'team1',
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
        views: {
            channel: {
                lastUnreadChannel: {
                    id: 'currentChannel',
                    hadMentions: false,
                },
            },
            channelSidebar: {
                unreadFilterEnabled: true,
            },
        },
    };

    test('should return channels sorted by recency', () => {
        expect(Selectors.getUnreadChannels(baseState)).toEqual([unreadChannel2, unreadChannel1, currentChannel]);
    });

    test('should return channels with mentions before those without', () => {
        let state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    myMembers: {
                        ...baseState.entities.channels.myMembers,
                        unreadChannel1: {notify_props: {}, mention_count: 2, msg_count: 8},
                    },
                },
                general: {
                    ...baseState.entities.general,
                },
                preferences: {
                    ...baseState.entities.preferences,
                },
            },
        };

        expect(Selectors.getUnreadChannels(state)).toEqual([unreadChannel1, unreadChannel2, currentChannel]);

        state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    myMembers: {
                        ...baseState.entities.channels.myMembers,
                        unreadChannel1: {notify_props: {}, mention_count: 2, msg_count: 8},
                        unreadChannel2: {notify_props: {}, mention_count: 1, msg_count: 8},
                    },
                },
                general: {
                    ...baseState.entities.general,
                },
                preferences: {
                    ...baseState.entities.preferences,
                },
            },
        };

        expect(Selectors.getUnreadChannels(state)).toEqual([unreadChannel2, unreadChannel1, currentChannel]);
    });

    test('with the unread filter enabled, should always return the current channel, even if it is not unread', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    currentChannelId: 'readChannel',
                },
                general: {
                    ...baseState.entities.general,
                },
                preferences: {
                    ...baseState.entities.preferences,
                },
            },
            views: {
                ...baseState.views,
                channel: {
                    ...baseState.views.channel,
                    lastUnreadChannel: {
                        id: 'readChannel',
                        hasMentions: true,
                    },
                },
                channelSidebar: {
                    ...baseState.views.channelSidebar,
                    unreadFilterEnabled: true,
                },
            },
        };

        expect(Selectors.getUnreadChannels(state)).toEqual([readChannel, unreadChannel2, unreadChannel1]);
    });

    test('with the unreads category enabled, should only return the current channel if it is lastUnreadChannel', () => {
        let state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    currentChannelId: 'readChannel',
                },
                general: {
                    ...baseState.entities.general,
                },
                preferences: {
                    ...baseState.entities.preferences,
                },
            },
            views: {
                ...baseState.views,
                channel: {
                    ...baseState.views.channel,
                    lastUnreadChannel: null,
                },
                channelSidebar: {
                    ...baseState.views.channelSidebar,
                    unreadFilterEnabled: false,
                },
            },
        };

        expect(Selectors.getUnreadChannels(state)).toEqual([unreadChannel2, unreadChannel1]);

        state = {
            ...state,
            views: {
                ...state.views,
                channel: {
                    ...state.views.channels,
                    lastUnreadChannel: {
                        id: 'readChannel',
                    },
                },
            },
        };

        expect(Selectors.getUnreadChannels(state)).toEqual([readChannel, unreadChannel2, unreadChannel1]);
    });

    test('should look at lastUnreadChannel to determine if the current channel had mentions before it was read', () => {
        let state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    currentChannelId: 'readChannel',
                    myMembers: {
                        ...baseState.entities.channels.myMembers,
                        unreadChannel1: {notify_props: {}, mention_count: 2, msg_count: 8},
                    },
                },
                general: {
                    ...baseState.entities.general,
                },
                preferences: {
                    ...baseState.entities.preferences,
                },
            },
            views: {
                ...baseState.views,
                channel: {
                    ...baseState.views.channel,
                    lastUnreadChannel: {
                        id: 'readChannel',
                        hadMentions: false,
                    },
                },
            },
        };

        // readChannel previously had no mentions, so it should be sorted with the non-mentions
        expect(Selectors.getUnreadChannels(state)).toEqual([unreadChannel1, readChannel, unreadChannel2]);

        state = {
            ...state,
            views: {
                ...state.views,
                channel: {
                    ...state.views.channel,
                    lastUnreadChannel: {
                        id: 'readChannel',
                        hadMentions: true,
                    },
                },
            },
        };

        // readChannel previously had a mention, so it should be sorted with the mentions
        expect(Selectors.getUnreadChannels(state)).toEqual([readChannel, unreadChannel1, unreadChannel2]);
    });

    test('should sort muted channels last', () => {
        let state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    myMembers: {
                        ...baseState.entities.channels.myMembers,
                        unreadChannel2: {notify_props: {mark_unread: 'all'}, msg_count: 10, mention_count: 2},
                    },
                },
                general: {
                    ...baseState.entities.general,
                },
                preferences: {
                    ...baseState.entities.preferences,
                },
            },
        };

        // No channels are muted
        expect(Selectors.getUnreadChannels(state)).toEqual([unreadChannel2, unreadChannel1, currentChannel]);

        state = {
            ...state,
            entities: {
                ...state.entities,
                channels: {
                    ...state.entities.channels,
                    myMembers: {
                        ...state.entities.channels.myMembers,
                        unreadChannel2: {notify_props: {mark_unread: 'mention'}, msg_count: 10, mention_count: 2},
                    },
                },
                general: {
                    ...baseState.entities.general,
                },
                preferences: {
                    ...baseState.entities.preferences,
                },
            },
        };

        // unreadChannel2 is muted and has a mention
        expect(Selectors.getUnreadChannels(state)).toEqual([unreadChannel1, currentChannel, unreadChannel2]);
    });

    test('should not show archived channels unless they are the current channel', () => {
        const archivedChannel = {id: 'archivedChannel', delete_at: 1, last_post_at: 400};

        let state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channels: {
                    ...baseState.entities.channels,
                    channels: {
                        ...baseState.entities.channels.channels,
                        archivedChannel,
                    },
                    channelsInTeam: {
                        ...baseState.entities.channels.channelsInTeam,
                        team1: [
                            ...baseState.entities.channels.channelsInTeam.team1,
                            'archivedChannel',
                        ],
                    },
                    messageCounts: {
                        ...baseState.entities.channels.messageCounts,
                        archivedChannel: {total: 10},
                    },
                    myMembers: {
                        ...baseState.entities.channels.myMembers,
                        archivedChannel: {notify_props: {}, mention_count: 0, msg_count: 0},
                    },
                },
            },
        };

        expect(Selectors.getUnreadChannels(state)).toEqual([unreadChannel2, unreadChannel1, currentChannel]);

        state = {
            ...state,
            entities: {
                ...state.entities,
                channels: {
                    ...state.entities.channels,
                    currentChannelId: 'archivedChannel',
                },
            },
            views: {
                ...state.views,
                channel: {
                    ...state.views.channel,
                    lastUnreadChannel: null,
                },
            },
        };

        expect(Selectors.getUnreadChannels(state)).toEqual([archivedChannel, unreadChannel2, unreadChannel1]);
    });
});

describe('getDisplayedChannels', () => {
    const currentChannel = TestHelper.getChannelMock({id: 'currentChannel', delete_at: 0, last_post_at: 0});
    const readChannel = {id: 'readChannel', delete_at: 0, last_post_at: 300};
    const unreadChannel1 = {id: 'unreadChannel1', delete_at: 0, last_post_at: 100};
    const unreadChannel2 = {id: 'unreadChannel2', delete_at: 0, last_post_at: 200};

    const category1 = {id: 'category1', team_id: 'team1', channel_ids: [currentChannel.id, unreadChannel1.id]};
    const category2 = {id: 'category2', team_id: 'team1', channel_ids: [readChannel.id, unreadChannel2.id]};

    const baseState = {
        entities: {
            channels: {
                channels: {
                    currentChannel,
                    readChannel,
                    unreadChannel1,
                    unreadChannel2,
                },
                channelsInTeam: {
                    team1: ['unreadChannel1', 'unreadChannel2', 'readChannel'],
                },
                currentChannelId: 'currentChannel',
                messageCounts: {
                    currentChannel: {total: 0},
                    readChannel: {total: 10},
                    unreadChannel1: {total: 10},
                    unreadChannel2: {total: 10},
                },
                myMembers: {
                    currentChannel: {notify_props: {}, mention_count: 0, msg_count: 0},
                    readChannel: {notify_props: {}, mention_count: 0, msg_count: 10},
                    unreadChannel1: {notify_props: {}, mention_count: 0, msg_count: 8},
                    unreadChannel2: {notify_props: {}, mention_count: 0, msg_count: 8},
                },
            },
            channelCategories: {
                byId: {
                    category1,
                    category2,
                },
                orderByTeam: {
                    team1: [category1.id, category2.id],
                },
            },
            general: {
                config: {
                    ExperimentalGroupUnreadChannels: 'true',
                },
            },
            posts: {
                postsInChannel: {},
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'false'},
                },
            },
            teams: {
                currentTeamId: 'team1',
            },
            users: {
                profiles: {},
            },
        },
        storage: {
            storage: {},
        },
        views: {
            channel: {
                lastUnreadChannel: null,
            },
            channelSidebar: {
                unreadFilterEnabled: false,
            },
        },
    };

    test('should return channels in the order that they appear in each category', () => {
        const state = baseState;

        expect(Selectors.getDisplayedChannels(state)).toEqual([
            currentChannel,
            unreadChannel1,
            readChannel,
            unreadChannel2,
        ]);
    });

    test('with unread filter enabled, should not return read channels', () => {
        const state = {
            ...baseState,
            views: {
                ...baseState.views,
                channelSidebar: {
                    unreadFilterEnabled: true,
                },
            },
        };

        expect(Selectors.getDisplayedChannels(state)).toEqual([
            unreadChannel2,
            unreadChannel1,
            currentChannel,
        ]);
    });

    test('with unreads section enabled, should have unread channels first', () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    ...baseState.preferences,
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'true'},
                    },
                },
            },
        };

        expect(Selectors.getDisplayedChannels(state)).toEqual([
            unreadChannel2,
            unreadChannel1,
            currentChannel,
            readChannel,
        ]);
    });

    describe('memoization', () => {
        test('should return the same result when called with the same state', () => {
            expect(Selectors.getDisplayedChannels(baseState)).toBe(Selectors.getDisplayedChannels(baseState));
        });

        test('should return the same result when called with identical state', () => {
            const modifiedState = {...baseState};

            expect(Selectors.getDisplayedChannels(baseState)).toBe(Selectors.getDisplayedChannels(modifiedState));
        });

        test('should return the same result when called with unrelated state changing', () => {
            const modifiedState = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    users: {
                        ...baseState.entities.users,
                        profiles: {
                            someUser: {id: 'someUser'},
                        },
                    },
                },
            };

            expect(Selectors.getDisplayedChannels(baseState)).toBe(Selectors.getDisplayedChannels(modifiedState));
        });

        test('should return a new result when the unreads section is enabled', () => {
            const modifiedState = {
                ...baseState,
                entities: {
                    ...baseState.entities,
                    preferences: {
                        ...baseState.preferences,
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'true'},
                        },
                    },
                },
            };

            expect(Selectors.getDisplayedChannels(baseState)).not.toBe(Selectors.getDisplayedChannels(modifiedState));
            expect(Selectors.getDisplayedChannels(modifiedState)).toBe(Selectors.getDisplayedChannels(modifiedState));
        });
    });
});

describe('makeGetFilteredChannelIdsForCategory', () => {
    const currentChannel = TestHelper.getChannelMock({id: 'currentChannel', delete_at: 0, last_post_at: 0});
    const readChannel = {id: 'readChannel', delete_at: 0, last_post_at: 300};
    const unreadChannel1 = {id: 'unreadChannel1', delete_at: 0, last_post_at: 100};
    const unreadChannel2 = {id: 'unreadChannel2', delete_at: 0, last_post_at: 200};

    const baseState = {
        entities: {
            channels: {
                channels: {
                    currentChannel,
                    readChannel,
                    unreadChannel1,
                    unreadChannel2,
                },
                channelsInTeam: {
                    team1: ['unreadChannel1', 'unreadChannel2', 'readChannel'],
                },
                currentChannelId: 'currentChannel',
                messageCounts: {
                    currentChannel: {total: 0},
                    readChannel: {total: 10},
                    unreadChannel1: {total: 10},
                    unreadChannel2: {total: 10},
                },
                myMembers: {
                    currentChannel: {notify_props: {}, mention_count: 0, msg_count: 0},
                    readChannel: {notify_props: {}, mention_count: 0, msg_count: 10},
                    unreadChannel1: {notify_props: {}, mention_count: 0, msg_count: 8},
                    unreadChannel2: {notify_props: {}, mention_count: 0, msg_count: 8},
                },
            },
            general: {
                config: {
                    ExperimentalGroupUnreadChannels: 'true',
                },
            },
            posts: {
                postsInChannel: {},
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'false'},
                },
            },
            teams: {
                currentTeamId: 'team1',
            },
            users: {
                profiles: {},
            },
        },
        views: {
            channel: {
                lastUnreadChannel: null,
            },
        },
    };

    test('should only include channels in the given category', () => {
        const category1 = {id: 'category1', team_id: 'team1', channel_ids: [currentChannel.id, unreadChannel1.id]};
        const category2 = {id: 'category2', team_id: 'team1', channel_ids: [readChannel.id, unreadChannel2.id]};

        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channelCategories: {
                    ...baseState.entities.channelCategories,
                    byId: {
                        category1,
                        category2,
                    },
                    orderByTeam: {
                        team1: [category1, category2],
                    },
                },
            },
        };

        const getFilteredChannelIdsForCategory = Selectors.makeGetFilteredChannelIdsForCategory();

        expect(getFilteredChannelIdsForCategory(state, category1)).toEqual([currentChannel.id, unreadChannel1.id]);
        expect(getFilteredChannelIdsForCategory(state, category2)).toEqual([readChannel.id, unreadChannel2.id]);
    });

    test('with the unreads category enabled, should not include unread channels', () => {
        const category1 = {id: 'category1', team_id: 'team1', channel_ids: [currentChannel.id, readChannel.id, unreadChannel1.id, unreadChannel2.id]};

        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channelCategories: {
                    ...baseState.entities.channelCategories,
                    byId: {
                        category1,
                    },
                    orderByTeam: {
                        team1: [category1],
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'true'},
                    },
                },
            },
        };

        const getFilteredChannelIdsForCategory = Selectors.makeGetFilteredChannelIdsForCategory();

        expect(getFilteredChannelIdsForCategory(state, category1)).toEqual([currentChannel.id, readChannel.id]);
    });

    test('with the unreads category enabled, should not include the current channel if it was previously unread', () => {
        const category1 = {id: 'category1', team_id: 'team1', channel_ids: [currentChannel.id, readChannel.id, unreadChannel1.id, unreadChannel2.id]};

        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                channelCategories: {
                    ...baseState.entities.channelCategories,
                    byId: {
                        category1,
                    },
                    orderByTeam: {
                        team1: [category1],
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.SHOW_UNREAD_SECTION)]: {value: 'true'},
                    },
                },
            },
            views: {
                ...baseState.views,
                channel: {
                    ...baseState.views.channel,
                    lastUnreadChannel: {
                        id: currentChannel.id,
                    },
                },
            },
        };

        const getFilteredChannelIdsForCategory = Selectors.makeGetFilteredChannelIdsForCategory();

        expect(getFilteredChannelIdsForCategory(state, category1)).toEqual([readChannel.id]);
    });
});
