// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CategorySorting} from '@mattermost/types/channel_categories';
import {GlobalState} from '@mattermost/types/store';

import {General, Preferences} from 'mattermost-redux/constants';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';
import {MarkUnread} from 'mattermost-redux/constants/channels';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import mergeObjects from '../../../test/merge_objects';
import TestHelper from '../../../test/test_helper';

import * as Selectors from './channel_categories';

const ch = TestHelper.getChannelMock;

describe('getCategoryInTeamByType', () => {
    const favoritesCategory1 = {id: 'favoritesCategory1', team_id: 'team1', type: CategoryTypes.FAVORITES};
    const channelsCategory1 = {id: 'channelsCategory1', team_id: 'team1', type: CategoryTypes.CHANNELS};
    const directMessagesCategory1 = {id: 'directMessagesCategory1', team_id: 'team1', type: CategoryTypes.DIRECT_MESSAGES};
    const channelsCategory2 = {id: 'channelsCategory2', team_id: 'team2', type: CategoryTypes.CHANNELS};

    const state = {
        entities: {
            channelCategories: {
                byId: {
                    channelsCategory1,
                    channelsCategory2,
                    directMessagesCategory1,
                    favoritesCategory1,
                },
            },
        },
    } as unknown as GlobalState;

    test('should return categories from each team', () => {
        expect(Selectors.getCategoryInTeamByType(state, 'team1', CategoryTypes.FAVORITES)).toBe(favoritesCategory1);
        expect(Selectors.getCategoryInTeamByType(state, 'team1', CategoryTypes.CHANNELS)).toBe(channelsCategory1);
        expect(Selectors.getCategoryInTeamByType(state, 'team1', CategoryTypes.DIRECT_MESSAGES)).toBe(directMessagesCategory1);

        expect(Selectors.getCategoryInTeamByType(state, 'team2', CategoryTypes.CHANNELS)).toBe(channelsCategory2);
    });

    test('should return null for a team that does not exist', () => {
        expect(Selectors.getCategoryInTeamByType(state, 'team3', CategoryTypes.CHANNELS)).toBeUndefined();
    });

    test('should return null for a category that does not exist', () => {
        expect(Selectors.getCategoryInTeamByType(state, 'team2', CategoryTypes.FAVORITES)).toBeUndefined();
    });
});

describe('getCategoryInTeamWithChannel', () => {
    const category1 = {id: 'category1', team_id: 'team1', channel_ids: ['channel1', 'channel2']};
    const category2 = {id: 'category2', team_id: 'team1', channel_ids: ['dmChannel1']};
    const category3 = {id: 'category3', team_id: 'team2', channel_ids: ['dmChannel1']};

    const state = {
        entities: {
            channelCategories: {
                byId: {
                    category1,
                    category2,
                    category3,
                },
            },
        },
    } as unknown as GlobalState;

    test('should return the category containing a given channel', () => {
        expect(Selectors.getCategoryInTeamWithChannel(state, 'team1', 'channel1')).toBe(category1);
        expect(Selectors.getCategoryInTeamWithChannel(state, 'team1', 'channel2')).toBe(category1);
    });

    test('should return the category on the correct team for a cross-team channel', () => {
        expect(Selectors.getCategoryInTeamWithChannel(state, 'team1', 'dmChannel1')).toBe(category2);
        expect(Selectors.getCategoryInTeamWithChannel(state, 'team2', 'dmChannel1')).toBe(category3);
    });
});

describe('makeGetCategoriesForTeam', () => {
    const category1 = {id: 'category1', display_name: 'Category One', type: CategoryTypes.CUSTOM};
    const category2 = {id: 'category2', display_name: 'Category Two', type: CategoryTypes.CUSTOM};

    const state = {
        entities: {
            channelCategories: {
                byId: {
                    category1,
                    category2,
                },
                orderByTeam: {
                    team1: [category2.id, category1.id],
                },
            },
        },
    } as unknown as GlobalState;

    test('should return categories for team in order', () => {
        const getCategoriesForTeam = Selectors.makeGetCategoriesForTeam();

        expect(getCategoriesForTeam(state, 'team1')).toEqual([
            state.entities.channelCategories.byId.category2,
            state.entities.channelCategories.byId.category1,
        ]);
    });

    test('should memoize properly', () => {
        const getCategoriesForTeam = Selectors.makeGetCategoriesForTeam();

        const result = getCategoriesForTeam(state, 'team1');

        // Repeat calls should return the same array
        expect(getCategoriesForTeam(state, 'team1')).toBe(result);

        // Calls to a difference instance of the selector won't return the same array
        expect(result).not.toBe(Selectors.makeGetCategoriesForTeam()(state, 'team1'));

        // Calls with different arguments won't return the same array
        expect(getCategoriesForTeam(state, 'team2')).not.toBe(result);

        // Calls after different argumetns won't return the same array
        expect(getCategoriesForTeam(state, 'team1')).not.toBe(result);
    });
});

describe('makeFilterAutoclosedDMs', () => {
    const currentUser = {id: 'currentUser'};

    const tigerKing = {id: 'tigerKing'};
    const bojackHorseman = {id: 'bojackHorseman'};
    const jeffWinger = {id: 'jeffWinger'};

    const baseState = {
        entities: {
            channels: {
                currentChannelId: 'channel1',
                messageCounts: {},
                myMembers: {
                    channel2: {
                        channel_id: 'channel2',
                        last_viewed_at: 0,
                    },
                    channel1: {},
                    channel3: {},
                },
            },
            general: {
                config: {},
            },
            posts: {
                posts: {},
                postsInChannel: {
                    channel1: [],
                },
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '0'},
                },
            },
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    currentUser,
                    tigerKing,
                    bojackHorseman,
                    jeffWinger,
                },
            },
        },
    };

    test('Should always show an unread channel', () => {
        const filterAutoclosedDMs = Selectors.makeFilterAutoclosedDMs();

        const gmChannel1 = ch({id: 'gmChannel1', type: General.GM_CHANNEL});
        const gmChannel2 = ch({id: 'gmChannel2', type: General.GM_CHANNEL});

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    messageCounts: {
                        gmChannel1: {total: 5},
                        gmChannel2: {total: 0},
                    },
                    myMembers: {
                        gmChannel1: {msg_count: 1, notify_props: {mark_unread: MarkUnread.ALL}},
                        gmChannel2: {msg_count: 0, notify_props: {mark_unread: MarkUnread.ALL}},
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '1'},
                    },
                },
            },
        });

        expect(filterAutoclosedDMs(state, [gmChannel1, gmChannel2], CategoryTypes.DIRECT_MESSAGES)).toEqual([gmChannel1]);
    });

    test('Should always show the current channel', () => {
        const filterAutoclosedDMs = Selectors.makeFilterAutoclosedDMs();

        const dmChannel1 = ch({id: 'dmChannel1', type: General.DM_CHANNEL, name: `${currentUser.id}__${jeffWinger.id}`});
        const gmChannel1 = ch({id: 'gmChannel1', type: General.GM_CHANNEL});

        let state = mergeObjects(baseState, {
            entities: {
                channels: {
                    currentChannelId: dmChannel1.id,
                    myMembers: {
                        [gmChannel1.id]: {last_viewed_at: 1000},
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '1'},
                    },
                },
            },
        });

        expect(filterAutoclosedDMs(state, [dmChannel1, gmChannel1], CategoryTypes.DIRECT_MESSAGES)).toEqual([dmChannel1]);

        state = mergeObjects(baseState, {
            entities: {
                channels: {
                    currentChannelId: gmChannel1.id,
                    myMembers: {
                        [dmChannel1.id]: {last_viewed_at: 1000},
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '1'},
                    },
                },
            },
        });

        expect(filterAutoclosedDMs(state, [gmChannel1, dmChannel1], CategoryTypes.DIRECT_MESSAGES)).toEqual([gmChannel1]);
    });

    describe('Should always show the exact number of channels specified by the user', () => {
        const filterAutoclosedDMs = Selectors.makeFilterAutoclosedDMs();

        const dmChannel1 = ch({id: 'dmChannel1', type: General.DM_CHANNEL, name: `${currentUser.id}__${tigerKing.id}`});
        const gmChannel1 = ch({id: 'gmChannel1', type: General.GM_CHANNEL, name: 'WhatsApp'});
        const gmChannel2 = ch({id: 'gmChannel2', type: General.GM_CHANNEL, name: 'Telegram'});
        const dmChannel2 = ch({id: 'dmChannel2', type: General.DM_CHANNEL, name: `${currentUser.id}__${bojackHorseman.id}`});
        const dmChannel3 = ch({id: 'dmChannel3', type: General.DM_CHANNEL, name: `${currentUser.id}__${jeffWinger.id}`});

        test('User specified 5 DMs to be shown', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    channels: {
                        currentChannelId: dmChannel1.id,
                        myMembers: {
                            [dmChannel1.id]: {last_viewed_at: 1000},
                            [dmChannel2.id]: {last_viewed_at: 500},
                            [dmChannel3.id]: {last_viewed_at: 0},
                        },
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '5'},
                        },
                    },
                },
            });

            expect(filterAutoclosedDMs(state, [dmChannel1, gmChannel1, gmChannel2, dmChannel2, dmChannel3], CategoryTypes.DIRECT_MESSAGES)).toEqual([dmChannel1, gmChannel1, gmChannel2, dmChannel2, dmChannel3]);
        });

        test('User specified 2 DMs to be shown', () => {
            const state = mergeObjects(baseState, {
                entities: {
                    channels: {
                        currentChannelId: dmChannel1.id,
                        myMembers: {
                            [dmChannel1.id]: {last_viewed_at: 1000},
                            [dmChannel2.id]: {last_viewed_at: 500},
                            [dmChannel3.id]: {last_viewed_at: 0},
                        },
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '2'},
                        },
                    },
                },
            });

            expect(filterAutoclosedDMs(state, [dmChannel1, gmChannel1, gmChannel2, dmChannel2, dmChannel3], CategoryTypes.DIRECT_MESSAGES)).toEqual([dmChannel1, dmChannel2]);
        });
    });

    test('should consider approximate view time and open time preferences for most recently viewed channel', () => {
        const filterAutoclosedDMs = Selectors.makeFilterAutoclosedDMs();

        const dmChannel1 = ch({id: 'dmChannel1', type: General.DM_CHANNEL, name: `${currentUser.id}__${tigerKing.id}`});
        const dmChannel2 = ch({id: 'dmChannel2', type: General.DM_CHANNEL, name: `${currentUser.id}__${bojackHorseman.id}`});
        const dmChannel3 = ch({id: 'dmChannel3', type: General.DM_CHANNEL, name: `${currentUser.id}__${jeffWinger.id}`});

        let state = mergeObjects(baseState, {
            entities: {
                channels: {
                    channels: {
                        dmChannel1,
                        dmChannel2,
                        dmChannel3,
                    },
                    myMembers: {
                        [dmChannel1.id]: {last_viewed_at: 1000},
                        [dmChannel2.id]: {last_viewed_at: 500},
                        [dmChannel3.id]: {last_viewed_at: 0},
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '2'},
                    },
                },
            },
        });

        expect(filterAutoclosedDMs(state, [dmChannel1, dmChannel2, dmChannel3], CategoryTypes.DIRECT_MESSAGES)).toEqual([dmChannel1, dmChannel2]);

        state = mergeObjects(state, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_CHANNEL_OPEN_TIME, dmChannel3.id)]: {value: '3000'},
                    },
                },
            },
        });

        expect(filterAutoclosedDMs(state, [dmChannel1, dmChannel2, dmChannel3], CategoryTypes.DIRECT_MESSAGES)).toEqual([dmChannel1, dmChannel3]);

        state = mergeObjects(state, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_CHANNEL_APPROXIMATE_VIEW_TIME, dmChannel2.id)]: {value: '2000'},
                    },
                },
            },
        });

        expect(filterAutoclosedDMs(state, [dmChannel1, dmChannel2, dmChannel3], CategoryTypes.DIRECT_MESSAGES)).toEqual([dmChannel2, dmChannel3]);
    });
});

describe('makeFilterManuallyClosedDMs', () => {
    const currentUser = {id: 'currentUser'};
    const otherUser1 = {id: 'otherUser1'};
    const otherUser2 = {id: 'otherUser2'};

    const baseState = {
        entities: {
            general: {
                config: {},
            },
            channels: {
                messageCounts: {},
                myMembers: {},
            },
            preferences: {
                myPreferences: {},
            },
            users: {
                currentUserId: currentUser.id,
            },
        },
    } as unknown as GlobalState;

    test('should filter DMs based on preferences', () => {
        const filterManuallyClosedDMs = Selectors.makeFilterManuallyClosedDMs();

        const dmChannel1 = ch({id: 'dmChannel1', type: General.DM_CHANNEL, name: `${currentUser.id}__${otherUser1.id}`});
        const dmChannel2 = ch({id: 'dmChannel2', type: General.DM_CHANNEL, name: `${currentUser.id}__${otherUser2.id}`});

        const state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser1.id)]: {value: 'false'},
                        [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser2.id)]: {value: 'true'},
                    },
                },
            },
        });

        expect(filterManuallyClosedDMs(state, [dmChannel1, dmChannel2])).toMatchObject([dmChannel2]);
    });

    test('should filter GMs based on preferences', () => {
        const filterManuallyClosedDMs = Selectors.makeFilterManuallyClosedDMs();

        const gmChannel1 = ch({id: 'gmChannel1', type: General.GM_CHANNEL});
        const gmChannel2 = ch({id: 'gmChannel2', type: General.GM_CHANNEL});

        const state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel1.id)]: {value: 'true'},
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel2.id)]: {value: 'false'},
                    },
                },
            },
        });

        expect(filterManuallyClosedDMs(state, [gmChannel1, gmChannel2])).toMatchObject([gmChannel1]);
    });

    test('should show unread DMs and GMs, regardless of preferences', () => {
        const filterManuallyClosedDMs = Selectors.makeFilterManuallyClosedDMs();

        const dmChannel1 = ch({id: 'dmChannel1', type: General.DM_CHANNEL, name: `${currentUser.id}__${otherUser1.id}`});
        const dmChannel2 = ch({id: 'dmChannel2', type: General.DM_CHANNEL, name: `${currentUser.id}__${otherUser2.id}`});
        const gmChannel1 = ch({id: 'gmChannel1', type: General.GM_CHANNEL});
        const gmChannel2 = ch({id: 'gmChannel2', type: General.GM_CHANNEL});

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    messageCounts: {
                        dmChannel1: {total: 1},
                        dmChannel2: {total: 0},
                        gmChannel1: {total: 1},
                        gmChannel2: {total: 0},
                    },
                    myMembers: {
                        dmChannel1: {msg_count: 0},
                        dmChannel2: {msg_count: 0},
                        gmChannel1: {msg_count: 0},
                        gmChannel2: {msg_count: 0},
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser1.id)]: {value: 'false'},
                        [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser2.id)]: {value: 'false'},
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel1.id)]: {value: 'false'},
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel2.id)]: {value: 'false'},
                    },
                },
            },
        });

        expect(filterManuallyClosedDMs(state, [dmChannel1, dmChannel2, gmChannel1, gmChannel2])).toEqual([dmChannel1, gmChannel1]);
    });

    test('should show the current channel, regardless of preferences', () => {
        const filterManuallyClosedDMs = Selectors.makeFilterManuallyClosedDMs();

        const dmChannel1 = ch({id: 'dmChannel1', type: General.DM_CHANNEL, name: `${currentUser.id}__${otherUser1.id}`});
        const gmChannel1 = ch({id: 'gmChannel1', type: General.GM_CHANNEL});

        let state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser1.id)]: {value: 'false'},
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel1.id)]: {value: 'false'},
                    },
                },
            },
        });

        expect(filterManuallyClosedDMs(state, [dmChannel1, gmChannel1])).toEqual([]);

        state = mergeObjects(baseState, {
            entities: {
                channels: {
                    currentChannelId: dmChannel1.id,
                },
            },
        });

        expect(filterManuallyClosedDMs(state, [dmChannel1, gmChannel1])).toEqual([dmChannel1]);

        state = mergeObjects(baseState, {
            entities: {
                channels: {
                    currentChannelId: gmChannel1.id,
                },
            },
        });

        expect(filterManuallyClosedDMs(state, [dmChannel1, gmChannel1])).toEqual([gmChannel1]);
    });

    test('should not filter other channels', () => {
        const filterManuallyClosedDMs = Selectors.makeFilterManuallyClosedDMs();

        const channel1 = ch({id: 'channel1', type: General.OPEN_CHANNEL});
        const channel2 = ch({id: 'channel2', type: General.PRIVATE_CHANNEL});

        const state = baseState;

        const channels = [channel1, channel2];

        expect(filterManuallyClosedDMs(state, channels)).toBe(channels);
    });
});

describe('makeSortChannelsByName', () => {
    const currentUser = {id: 'currentUser', locale: 'en'};

    const baseState = {
        entities: {
            channels: {
                myMembers: {},
            },
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    currentUser,
                },
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    } as unknown as GlobalState;

    test('should sort channels by display name', () => {
        const sortChannelsByName = Selectors.makeSortChannelsByName();

        const channel1 = ch({id: 'channel1', display_name: 'Carrot'});
        const channel2 = ch({id: 'channel2', display_name: 'Apple'});
        const channel3 = ch({id: 'channel3', display_name: 'Banana'});
        const channels = [channel1, channel2, channel3];

        expect(sortChannelsByName(baseState, channels)).toEqual([channel2, channel3, channel1]);
    });

    test('should sort channels by display name with numbers', () => {
        const sortChannelsByName = Selectors.makeSortChannelsByName();

        const channel1 = ch({id: 'channel1', display_name: 'Channel 10'});
        const channel2 = ch({id: 'channel2', display_name: 'Channel 1'});
        const channel3 = ch({id: 'channel3', display_name: 'Channel 11'});
        const channel4 = ch({id: 'channel4', display_name: 'Channel 1a'});
        const channels = [channel1, channel2, channel3, channel4];

        expect(sortChannelsByName(baseState, channels)).toEqual([channel2, channel4, channel1, channel3]);
    });

    test('should sort muted channels last', () => {
        const sortChannelsByName = Selectors.makeSortChannelsByName();

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    myMembers: {
                        channel1: {notify_props: {mark_unread: MarkUnread.MENTION}},
                        channel3: {notify_props: {mark_unread: MarkUnread.MENTION}},
                        channel4: {notify_props: {mark_unread: MarkUnread.ALL}},
                    },
                },
            },
        });

        const channel1 = ch({id: 'channel1', display_name: 'Carrot'});
        const channel2 = ch({id: 'channel2', display_name: 'Apple'});
        const channel3 = ch({id: 'channel3', display_name: 'Banana'});
        const channel4 = ch({id: 'channel4', display_name: 'Dragonfruit'});
        const channels = [channel1, channel2, channel3, channel4];

        expect(sortChannelsByName(state, channels)).toEqual([channel2, channel4, channel3, channel1]);
    });
});

describe('makeSortChannelsByNameWithDMs', () => {
    const currentUser = {id: 'currentUser', username: 'currentUser', first_name: 'Current', last_name: 'User', locale: 'en'};
    const otherUser1 = {id: 'otherUser1', username: 'otherUser1', first_name: 'Other', last_name: 'User', locale: 'en'};
    const otherUser2 = {id: 'otherUser2', username: 'otherUser2', first_name: 'Another', last_name: 'User', locale: 'en'};

    const channel1 = ch({id: 'channel1', type: General.OPEN_CHANNEL, display_name: 'Zebra'});
    const channel2 = ch({id: 'channel2', type: General.PRIVATE_CHANNEL, display_name: 'Aardvark'});
    const channel3 = ch({id: 'channel3', type: General.OPEN_CHANNEL, display_name: 'Bear'});
    const dmChannel1 = ch({id: 'dmChannel1', type: General.DM_CHANNEL, display_name: '', name: `${currentUser.id}__${otherUser1.id}`});
    const dmChannel2 = ch({id: 'dmChannel2', type: General.DM_CHANNEL, display_name: '', name: `${otherUser2.id}__${currentUser.id}`});
    const gmChannel1 = ch({id: 'gmChannel1', type: General.GM_CHANNEL, display_name: `${currentUser.username}, ${otherUser1.username}, ${otherUser2.username}`, name: 'gmChannel1'});

    const baseState = {
        entities: {
            channels: {
                myMembers: {},
            },
            general: {
                config: {},
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.NAME_NAME_FORMAT)]: {value: Preferences.DISPLAY_PREFER_FULL_NAME},
                },
            },
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    currentUser,
                    otherUser1,
                    otherUser2,
                },
            },
        },
    } as unknown as GlobalState;

    test('should sort regular channels by display name', () => {
        const sortChannelsByNameWithDMs = Selectors.makeSortChannelsByNameWithDMs();

        expect(sortChannelsByNameWithDMs(baseState, [
            channel1,
            channel2,
            channel3,
        ])).toMatchObject([
            channel2, // Aardvark
            channel3, // Bear
            channel1, // Zebra
        ]);
    });

    test('should sort DM channels by the display name of the other user', () => {
        const sortChannelsByNameWithDMs = Selectors.makeSortChannelsByNameWithDMs();

        expect(sortChannelsByNameWithDMs(baseState, [
            channel1,
            channel2,
            channel3,
            dmChannel1,
            dmChannel2,
        ])).toMatchObject([
            channel2, // Aardvark
            dmChannel2, // Another User
            channel3, // Bear
            dmChannel1, // Other User
            channel1, // Zebra
        ]);
    });

    test('should sort GM channels by the display name of the other users', () => {
        const sortChannelsByNameWithDMs = Selectors.makeSortChannelsByNameWithDMs();

        let state = baseState;

        expect(sortChannelsByNameWithDMs(state, [
            channel1,
            channel2,
            channel3,
            gmChannel1,
        ])).toMatchObject([
            channel2, // Aardvark
            gmChannel1, // Another User, Other User
            channel3, // Bear
            channel1, // Zebra
        ]);

        state = mergeObjects(state, {
            entities: {
                users: {
                    currentUserId: otherUser2.id,
                },
            },
        });

        expect(sortChannelsByNameWithDMs(state, [
            channel1,
            channel2,
            channel3,
            gmChannel1,
        ])).toMatchObject([
            channel2, // Aardvark
            channel3, // Bear
            gmChannel1, // Current User, Other User
            channel1, // Zebra
        ]);
    });

    test('should sort muted channels last', () => {
        const sortChannelsByNameWithDMs = Selectors.makeSortChannelsByNameWithDMs();

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    myMembers: {
                        channel3: {notify_props: {mark_unread: MarkUnread.MENTION}},
                        dmChannel1: {notify_props: {mark_unread: MarkUnread.MENTION}},
                        dmChannel2: {notify_props: {mark_unread: MarkUnread.ALL}},
                        gmChannel1: {notify_props: {mark_unread: MarkUnread.MENTION}},
                    },
                },
            },
        });

        expect(sortChannelsByNameWithDMs(state, [
            channel1,
            channel2,
            channel3,
            dmChannel1,
            dmChannel2,
            gmChannel1,
        ])).toMatchObject([
            channel2, // Aardvark
            dmChannel2, // Another User
            channel1, // Zebra
            gmChannel1, // Another User, Other User (Muted)
            channel3, // Bear (Muted)
            dmChannel1, // Other User (Muted)
        ]);
    });
});

describe('makeSortChannelsByRecency', () => {
    const channel1 = ch({id: 'channel1', display_name: 'Apple', last_post_at: 1000, last_root_post_at: 3000, create_at: 0});
    const channel2 = ch({id: 'channel2', display_name: 'Banana', last_post_at: 2000, last_root_post_at: 1000, create_at: 0});
    const channel3 = ch({id: 'channel3', display_name: 'Zucchini', last_post_at: 3000, last_root_post_at: 2000, create_at: 0});

    const baseState = {
        entities: {
            posts: {
                posts: {},
                postsInChannel: {},
            },
            general: {
                config: {
                    CollapsedThreads: 'default_off',
                },
            },
            preferences: {
                myPreferences: {},
            },
        },
    } as unknown as GlobalState;

    test('should sort channels by their last_post_at when no posts are loaded', () => {
        const sortChannelsByRecency = Selectors.makeSortChannelsByRecency();

        const state = baseState;

        expect(sortChannelsByRecency(state, [channel1, channel2, channel3])).toMatchObject([channel3, channel2, channel1]);
        expect(sortChannelsByRecency(state, [channel3, channel2, channel1])).toMatchObject([channel3, channel2, channel1]);
    });

    test('should sort channels by their last_post_at when no posts are loaded and CRT in enabled', () => {
        const sortChannelsByRecency = Selectors.makeSortChannelsByRecency();

        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.COLLAPSED_REPLY_THREADS}`]: {
                            value: 'on',
                        },
                    },
                },
            },
        } as unknown as GlobalState;

        expect(sortChannelsByRecency(state, [channel3, channel2, channel1])).toMatchObject([channel1, channel3, channel2]);
        expect(sortChannelsByRecency(state, [channel1, channel3, channel2])).toMatchObject([channel1, channel3, channel2]);
    });
});

describe('makeGetChannelIdsForCategory', () => {
    const currentUser = {id: 'currentUser', username: 'currentUser', first_name: 'Current', last_name: 'User', locale: 'en'};
    const otherUser1 = {id: 'otherUser1', username: 'otherUser1', first_name: 'Other', last_name: 'User', locale: 'en'};
    const otherUser2 = {id: 'otherUser2', username: 'otherUser2', first_name: 'Another', last_name: 'User', locale: 'en'};

    const channel1 = {id: 'channel1', type: General.OPEN_CHANNEL, team_id: 'team1', display_name: 'Zebra', delete_at: 0, create_at: 0};
    const channel2 = {id: 'channel2', type: General.PRIVATE_CHANNEL, team_id: 'team1', display_name: 'Aardvark', delete_at: 0, create_at: 0};
    const channel3 = {id: 'channel3', type: General.OPEN_CHANNEL, team_id: 'team1', display_name: 'Bear', delete_at: 0, create_at: 0};
    const dmChannel1 = {id: 'dmChannel1', type: General.DM_CHANNEL, team_id: '', display_name: '', name: `${currentUser.id}__${otherUser1.id}`, delete_at: 0, last_post_at: 2000, create_at: 0};
    const dmChannel2 = {id: 'dmChannel2', type: General.DM_CHANNEL, team_id: '', display_name: '', name: `${otherUser2.id}__${currentUser.id}`, delete_at: 0, create_at: 0};
    const gmChannel1 = {id: 'gmChannel1', type: General.GM_CHANNEL, team_id: '', display_name: `${currentUser.username}, ${otherUser1.username}, ${otherUser2.username}`, name: 'gmChannel1', delete_at: 0, create_at: 0};

    const baseState = {
        entities: {
            channels: {
                channels: {
                    channel1,
                    channel2,
                    channel3,
                    dmChannel1,
                    dmChannel2,
                    gmChannel1,
                },
                messageCounts: {},
                myMembers: {
                    [channel1.id]: {},
                    [channel2.id]: {},
                    [channel3.id]: {},
                    [dmChannel1.id]: {},
                    [dmChannel2.id]: {},
                    [gmChannel1.id]: {},
                },
            },
            general: {
                config: {},
            },
            posts: {
                posts: {},
                postsInChannel: {},
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.NAME_NAME_FORMAT)]: {value: Preferences.DISPLAY_PREFER_FULL_NAME},
                    [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser1.id)]: {value: 'true'},
                    [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser2.id)]: {value: 'true'},
                    [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel1.id)]: {value: 'true'},
                },
            },
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    currentUser,
                    otherUser1,
                    otherUser2,
                },
            },
        },
    } as unknown as GlobalState;

    test('should return sorted and filtered channels for favorites category', () => {
        const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

        const favoritesCategory = {
            id: 'favoritesCategory',
            team_id: 'team1',
            display_name: CategoryTypes.FAVORITES,
            type: CategoryTypes.FAVORITES,
            sorting: CategorySorting.Default,
            channel_ids: [dmChannel2.id, channel1.id],
            user_id: '',
            muted: false,
            collapsed: false,
        };

        expect(getChannelIdsForCategory(baseState, favoritesCategory)).toMatchObject([dmChannel2.id, channel1.id]);
    });

    test('should return sorted and filtered channels for channels category with manual sorting', () => {
        const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

        const publicCategory = {
            id: 'publicCategory',
            team_id: 'team1',
            display_name: 'Public Channels',
            type: CategoryTypes.PUBLIC,
            sorting: CategorySorting.Manual,
            channel_ids: [channel3.id, channel2.id],
            user_id: '',
            muted: false,
            collapsed: false,
        };

        expect(getChannelIdsForCategory(baseState, publicCategory)).toMatchObject([channel3.id, channel2.id]);
    });

    test('should return sorted and filtered channels for channels category with alphabetical sorting', () => {
        const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

        const publicCategory = {
            id: 'publicCategory',
            team_id: 'team1',
            display_name: 'Public Channels',
            type: CategoryTypes.PUBLIC,
            sorting: CategorySorting.Alphabetical,
            channel_ids: [channel3.id, channel2.id],
            user_id: '',
            muted: false,
            collapsed: false,
        };

        expect(getChannelIdsForCategory(baseState, publicCategory)).toMatchObject([channel2.id, channel3.id]);
    });

    test('should return sorted and filtered channels for channels category with alphabetical sorting and a muted channel', () => {
        const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    myMembers: {
                        [channel2.id]: {notify_props: {mark_unread: MarkUnread.MENTION}},
                    },
                },
            },
        });

        const publicCategory = {
            id: 'publicCategory',
            team_id: 'team1',
            display_name: 'Public Channels',
            type: CategoryTypes.PUBLIC,
            sorting: CategorySorting.Alphabetical,
            channel_ids: [channel2.id, channel3.id],
            user_id: '',
            muted: false,
            collapsed: false,
        };

        expect(getChannelIdsForCategory(state, publicCategory)).toMatchObject([channel3.id, channel2.id]);
    });

    test('should return sorted and filtered channels for direct messages category with alphabetical sorting', () => {
        const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

        const state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '2'},
                    },
                },
            },
        });

        const directMessagesCategory = {
            id: 'directMessagesCategory',
            team_id: 'team1',
            display_name: 'Direct Messages',
            type: CategoryTypes.DIRECT_MESSAGES,
            sorting: CategorySorting.Alphabetical,
            channel_ids: [gmChannel1.id, dmChannel1.id],
            user_id: '',
            muted: false,
            collapsed: false,
        };

        expect(getChannelIdsForCategory(state, directMessagesCategory)).toMatchObject([gmChannel1.id, dmChannel1.id]);
    });

    test('should return sorted and filtered channels for direct messages category with recency sorting', () => {
        const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

        const otherUser3 = {id: 'otherUser3', username: 'otherUser3', first_name: 'Third', last_name: 'User', locale: 'en'};
        const gmChannel2 = {id: 'gmChannel2', type: General.GM_CHANNEL, team_id: '', display_name: `${currentUser.username}, ${otherUser1.username}, ${otherUser3.username}`, name: 'gmChannel2', delete_at: 0, last_post_at: 2000, create_at: 0};

        const directMessagesCategory = {
            id: 'directMessagesCategory',
            team_id: 'team1',
            display_name: 'Direct Messages',
            type: CategoryTypes.DIRECT_MESSAGES,
            sorting: CategorySorting.Recency,
            channel_ids: [gmChannel1.id, dmChannel1.id, gmChannel2.id],
            user_id: '',
            muted: false,
            collapsed: false,
        };

        const state = mergeObjects(baseState, {
            entities: {
                channels: {
                    channels: {
                        dmChannel1: {last_post_at: 3000},
                        gmChannel1: {last_post_at: 1000},
                        gmChannel2,
                    },
                    myMembers: {
                        [gmChannel2.id]: {},
                    },
                },
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '3'},
                        [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel2.id)]: {value: 'true'},
                    },
                },
                users: {
                    profiles: {
                        otherUser3,
                    },
                },
            },
        });

        expect(getChannelIdsForCategory(state, directMessagesCategory)).toMatchObject(['dmChannel1', 'gmChannel2', 'gmChannel1']);
    });

    describe('memoization', () => {
        test('should return the same result when called twice with the same category', () => {
            const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

            const favoritesCategory = {
                id: 'favoritesCategory',
                team_id: 'team1',
                display_name: CategoryTypes.FAVORITES,
                type: CategoryTypes.FAVORITES,
                sorting: CategorySorting.Default,
                channel_ids: [dmChannel1.id, channel1.id],
                user_id: '',
                muted: false,
                collapsed: false,
            };

            const originalResult = getChannelIdsForCategory(baseState, favoritesCategory);

            expect(getChannelIdsForCategory(baseState, favoritesCategory)).toBe(originalResult);
        });

        test('should return a different result when called twice with a different category', () => {
            const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

            const favoritesCategory = {
                id: 'favoritesCategory',
                team_id: 'team1',
                display_name: CategoryTypes.FAVORITES,
                type: CategoryTypes.FAVORITES,
                sorting: CategorySorting.Default,
                channel_ids: [dmChannel1.id, channel1.id],
                user_id: '',
                muted: false,
                collapsed: false,
            };
            const publicCategory = {
                id: 'publicCategory',
                team_id: 'team1',
                display_name: 'Public Channels',
                type: CategoryTypes.PUBLIC,
                sorting: CategorySorting.Manual,
                channel_ids: [channel3.id, channel2.id],
                user_id: '',
                muted: false,
                collapsed: false,
            };

            const originalResult = getChannelIdsForCategory(baseState, favoritesCategory);

            expect(getChannelIdsForCategory(baseState, publicCategory)).not.toBe(originalResult);
        });

        test('should return a different result when called with a different sorting method', () => {
            const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

            const favoritesCategory = {
                id: 'favoritesCategory',
                team_id: 'team1',
                display_name: CategoryTypes.FAVORITES,
                type: CategoryTypes.FAVORITES,
                sorting: CategorySorting.Default,
                channel_ids: [dmChannel1.id, dmChannel2.id],
                user_id: '',
                muted: false,
                collapsed: false,
            };

            const originalResult = getChannelIdsForCategory(baseState, favoritesCategory);

            expect(getChannelIdsForCategory(baseState, {
                ...favoritesCategory,
                sorting: CategorySorting.Recency,
            })).not.toBe(originalResult);
        });

        test('should return the same result when called with a different sorting method but only a single channel', () => {
            const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

            const favoritesCategory = {
                id: 'favoritesCategory',
                team_id: 'team1',
                display_name: CategoryTypes.FAVORITES,
                type: CategoryTypes.FAVORITES,
                sorting: CategorySorting.Default,
                channel_ids: [dmChannel2.id],
                user_id: '',
                muted: false,
                collapsed: false,
            };

            const originalResult = getChannelIdsForCategory(baseState, favoritesCategory);

            expect(getChannelIdsForCategory(baseState, {
                ...favoritesCategory,
                sorting: CategorySorting.Alphabetical,
            })).toBe(originalResult);
            expect(getChannelIdsForCategory(baseState, {
                ...favoritesCategory,
                sorting: CategorySorting.Recency,
            })).toBe(originalResult);
        });

        test('should return a new result when DM category limit changes', () => {
            const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

            let state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '2'},
                        },
                    },
                },
            });

            const directMessagesCategory = {
                id: 'directMessagesCategory',
                team_id: 'team1',
                display_name: 'Direct Messages',
                type: CategoryTypes.DIRECT_MESSAGES,
                sorting: CategorySorting.Alphabetical,
                channel_ids: [gmChannel1.id, dmChannel1.id],
                user_id: '',
                muted: false,
                collapsed: false,
            };

            const originalResult = getChannelIdsForCategory(state, directMessagesCategory);

            state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '1'},
                        },
                    },
                },
            });

            expect(getChannelIdsForCategory(state, directMessagesCategory)).not.toBe(originalResult);
        });

        test('should return a different result for DMs only when a name change causes an order change', () => {
            const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

            const directMessagesCategory = {
                id: 'directMessagesCategory',
                team_id: 'team1',
                display_name: 'Direct Messages',
                type: CategoryTypes.DIRECT_MESSAGES,
                sorting: CategorySorting.Alphabetical,
                channel_ids: [dmChannel1.id, dmChannel2.id],
                user_id: '',
                muted: false,
                collapsed: false,
            };

            // otherUser2 (Another User), otherUser1 (Other User)
            let result = getChannelIdsForCategory(baseState, directMessagesCategory);
            expect(result).toEqual([dmChannel2.id, dmChannel1.id]);

            let previousResult = result;
            let state = mergeObjects(baseState, {
                entities: {
                    users: {
                        profiles: {
                            otherUser2: {...otherUser2, first_name: 'User', last_name: 'User'},
                        },
                    },
                },
            });

            // otherUser1 (Other User), otherUser2 (User User)
            result = getChannelIdsForCategory(state, directMessagesCategory);
            expect(result).toEqual([dmChannel1.id, dmChannel2.id]);
            expect(result).not.toBe(previousResult);

            previousResult = result;
            state = mergeObjects(state, {
                entities: {
                    users: {
                        profiles: {
                            otherUser1: {...otherUser1, first_name: 'Zoo', last_name: 'User'},
                        },
                    },
                },
            });

            // otherUser2 (User User), otherUser1 (Zoo User)
            result = getChannelIdsForCategory(state, directMessagesCategory);
            expect(result).toEqual([dmChannel2.id, dmChannel1.id]);
            expect(result).not.toBe(previousResult);

            previousResult = result;
            state = mergeObjects(state, {
                entities: {
                    users: {
                        profiles: {
                            otherUser2: {...otherUser2, first_name: 'Some', last_name: 'User'},
                        },
                    },
                },
            });

            // otherUser2 (Some User), otherUser1 (Zoo User)
            result = getChannelIdsForCategory(state, directMessagesCategory);
            expect(result).toEqual([dmChannel2.id, dmChannel1.id]);
            expect(result).toBe(previousResult);
        });

        test('should return a different result for alphabetically sorted DMs when the display name setting causes an order change', () => {
            const getChannelIdsForCategory = Selectors.makeGetChannelIdsForCategory();

            const directMessagesCategory = {
                id: 'directMessagesCategory',
                team_id: 'team1',
                display_name: 'Direct Messages',
                type: CategoryTypes.DIRECT_MESSAGES,
                sorting: CategorySorting.Alphabetical,
                channel_ids: [dmChannel1.id, dmChannel2.id],
                user_id: '',
                muted: false,
                collapsed: false,
            };

            // otherUser2 (Another User), otherUser1 (Other User)
            const originalResult = getChannelIdsForCategory(baseState, directMessagesCategory);
            expect(originalResult).toEqual([dmChannel2.id, dmChannel1.id]);

            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.NAME_NAME_FORMAT)]: {value: Preferences.DISPLAY_PREFER_USERNAME},
                        },
                    },
                },
            });

            // otherUser1, otherUser2
            const result = getChannelIdsForCategory(state, directMessagesCategory);
            expect(result).toEqual([dmChannel1.id, dmChannel2.id]);
            expect(result).not.toBe(originalResult);
        });
    });
});

describe('makeGetChannelsByCategory', () => {
    const currentUser = {id: 'currentUser', username: 'currentUser', first_name: 'Current', last_name: 'User', locale: 'en'};
    const otherUser1 = {id: 'otherUser1', username: 'otherUser1', first_name: 'Other', last_name: 'User', locale: 'en'};
    const otherUser2 = {id: 'otherUser2', username: 'otherUser2', first_name: 'Another', last_name: 'User', locale: 'en'};

    const channel1 = {id: 'channel1', type: General.OPEN_CHANNEL, team_id: 'team1', display_name: 'Zebra', delete_at: 0};
    const channel2 = {id: 'channel2', type: General.PRIVATE_CHANNEL, team_id: 'team1', display_name: 'Aardvark', delete_at: 0};
    const channel3 = {id: 'channel3', type: General.OPEN_CHANNEL, team_id: 'team1', display_name: 'Bear', delete_at: 0};
    const dmChannel1 = {id: 'dmChannel1', type: General.DM_CHANNEL, team_id: '', display_name: '', name: `${currentUser.id}__${otherUser1.id}`, delete_at: 0, last_post_at: 2000};
    const dmChannel2 = {id: 'dmChannel2', type: General.DM_CHANNEL, team_id: '', display_name: '', name: `${otherUser2.id}__${currentUser.id}`, delete_at: 0};
    const gmChannel1 = {id: 'gmChannel1', type: General.GM_CHANNEL, team_id: '', display_name: `${currentUser.username}, ${otherUser1.username}, ${otherUser2.username}`, name: 'gmChannel1', delete_at: 0, last_post_at: 1000};

    const favoritesCategory = {
        id: 'favoritesCategory',
        team_id: 'team1',
        display_name: CategoryTypes.FAVORITES,
        type: CategoryTypes.FAVORITES,
        sorting: CategorySorting.Alphabetical,
        channel_ids: [channel1.id, dmChannel2.id],
        user_id: '',
        muted: false,
        collapsed: false,
    };
    const channelsCategory = {
        id: 'channelsCategory',
        team_id: 'team1',
        display_name: 'Channels',
        type: CategoryTypes.CHANNELS,
        sorting: CategorySorting.Default,
        channel_ids: [channel2.id, channel3.id],
        user_id: '',
        muted: false,
        collapsed: false,
    };
    const directMessagesCategory = {
        id: 'directMessagesCategory',
        team_id: 'team1',
        display_name: 'Direct Messages',
        type: CategoryTypes.DIRECT_MESSAGES,
        sorting: CategorySorting.Recency,
        channel_ids: [dmChannel1.id, gmChannel1.id],
        user_id: '',
        muted: false,
        collapsed: false,
    };

    const baseState = {
        entities: {
            channelCategories: {
                byId: {
                    favoritesCategory,
                    channelsCategory,
                    directMessagesCategory,
                },
                orderByTeam: {
                    team1: [
                        favoritesCategory.id,
                        channelsCategory.id,
                        directMessagesCategory.id,
                    ],
                },
            },
            channels: {
                channels: {
                    channel1,
                    channel2,
                    channel3,
                    dmChannel1,
                    dmChannel2,
                    gmChannel1,
                },
                messageCounts: {},
                myMembers: {
                    [channel1.id]: {},
                    [channel2.id]: {},
                    [channel3.id]: {},
                    [dmChannel1.id]: {},
                    [dmChannel2.id]: {},
                    [gmChannel1.id]: {},
                },
            },
            general: {
                config: {},
            },
            posts: {
                posts: {},
                postsInChannel: {},
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.NAME_NAME_FORMAT)]: {value: Preferences.DISPLAY_PREFER_FULL_NAME},
                    [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser1.id)]: {value: 'true'},
                    [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser2.id)]: {value: 'true'},
                    [getPreferenceKey(Preferences.CATEGORY_GROUP_CHANNEL_SHOW, gmChannel1.id)]: {value: 'true'},
                    [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '3'},
                },
            },
            users: {
                currentUserId: currentUser.id,
                profiles: {
                    currentUser,
                    otherUser1,
                    otherUser2,
                },
            },
        },
    } as unknown as GlobalState;

    test('should return channels for all categories', () => {
        const getChannelsByCategory = Selectors.makeGetChannelsByCategory();

        const state = mergeObjects(baseState, {
            entities: {
                preferences: {
                    myPreferences: {
                        [getPreferenceKey(Preferences.CATEGORY_SIDEBAR_SETTINGS, Preferences.LIMIT_VISIBLE_DMS_GMS)]: {value: '2'},
                    },
                },
            },
        });
        const result = getChannelsByCategory(state, 'team1');
        expect(result.favoritesCategory).toEqual([dmChannel2, channel1]);
        expect(result.channelsCategory).toEqual([channel2, channel3]);
        expect(result.directMessagesCategory).toEqual([dmChannel1, gmChannel1]);
    });

    describe('memoization', () => {
        test('should return the same object when called with the same state', () => {
            const getChannelsByCategory = Selectors.makeGetChannelsByCategory();

            expect(getChannelsByCategory(baseState, 'team1')).toBe(getChannelsByCategory(baseState, 'team1'));
        });

        test('should return the same object when unrelated state changes', () => {
            const getChannelsByCategory = Selectors.makeGetChannelsByCategory();

            const state = mergeObjects(baseState, {
                views: {
                    something: 7,
                },
            });

            const previousResult = getChannelsByCategory(baseState, 'team1');
            const result = getChannelsByCategory(state, 'team1');

            expect(result).toBe(previousResult);
        });

        test('should return a new object when user profiles change', () => {
            // This behaviour isn't ideal, but it's better than the previous version which returns a new object
            // whenever anything user-related changes
            const getChannelsByCategory = Selectors.makeGetChannelsByCategory();

            const state = mergeObjects(baseState, {
                entities: {
                    users: {
                        profiles: {
                            newUser: {id: 'newUser'},
                        },
                    },
                },
            });

            const previousResult = getChannelsByCategory(baseState, 'team1');
            const result = getChannelsByCategory(state, 'team1');

            expect(result).not.toBe(previousResult);
            expect(result).toEqual(previousResult);

            // Categories not containing DMs/GMs and sorted alphabetically should still remain the same
            expect(result.favoritesCategory).not.toBe(previousResult.favoritesCategory);
            expect(result.favoritesCategory).toEqual(previousResult.favoritesCategory);
            expect(result.channelsCategory).toBe(previousResult.channelsCategory);
            expect(result.directMessagesCategory).toEqual(previousResult.directMessagesCategory);
            expect(result.directMessagesCategory).toEqual(previousResult.directMessagesCategory);
        });

        test('should return the same object when other user state changes', () => {
            const getChannelsByCategory = Selectors.makeGetChannelsByCategory();

            const state = mergeObjects(baseState, {
                entities: {
                    users: {
                        statuses: {
                            otherUser1: 'offline',
                        },
                    },
                },
            });

            const previousResult = getChannelsByCategory(baseState, 'team1');
            const result = getChannelsByCategory(state, 'team1');

            expect(result).toBe(previousResult);
        });

        test('should not return a new object when unrelated preferences change', () => {
            const getChannelsByCategory = Selectors.makeGetChannelsByCategory();

            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey('abc', '123')]: {value: 'true'},
                        },
                    },
                },
            });

            const previousResult = getChannelsByCategory(baseState, 'team1');
            const result = getChannelsByCategory(state, 'team1');

            expect(result).toBe(previousResult);
        });

        test('should return a new object when a DM is closed', () => {
            const getChannelsByCategory = Selectors.makeGetChannelsByCategory();

            const state = mergeObjects(baseState, {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.CATEGORY_DIRECT_CHANNEL_SHOW, otherUser1.id)]: {value: 'false'},
                        },
                    },
                },
            });

            const previousResult = getChannelsByCategory(baseState, 'team1');
            const result = getChannelsByCategory(state, 'team1');

            expect(result).not.toBe(previousResult);
            expect(result.favoritesCategory).toEqual(previousResult.favoritesCategory);
            expect(result.channelsCategory).toEqual(previousResult.channelsCategory);
            expect(result.directMessagesCategory).not.toEqual(previousResult.directMessagesCategory);
        });
    });
});
