// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import nock from 'nock';

import configureStore from 'mattermost-redux/test/test_store';

import {Client4} from 'mattermost-redux/client';

import {General} from '../constants';
import {CategoryTypes} from '../constants/channel_categories';
import {MarkUnread} from '../constants/channels';

import {getAllCategoriesByIds, getCategory} from 'mattermost-redux/selectors/entities/channel_categories';
import {isFavoriteChannel} from 'mattermost-redux/selectors/entities/channels';

import TestHelper, {DEFAULT_SERVER} from 'mattermost-redux/test/test_helper';

import {CategorySorting} from '@mattermost/types/channel_categories';

import * as Actions from './channel_categories';

const OK_RESPONSE = {status: 'OK'};

beforeAll(() => {
    Client4.setUrl(DEFAULT_SERVER);
});

describe('patchCategory', () => {
    const currentUserId = TestHelper.generateId();
    const teamId = TestHelper.generateId();

    const category1 = {
        id: 'category1',
        team_id: teamId,
        type: CategoryTypes.CUSTOM,
        display_name: 'Category One',
        sorting: CategorySorting.Recency,
    };

    const initialState = {
        entities: {
            channelCategories: {
                byId: {
                    category1,
                },
            },
            users: {
                currentUserId,
            },
        },
    };

    test('should only modify the provided fields', async () => {
        const store = configureStore(initialState);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category1.id}`).
            reply(200, {...category1, display_name: 'Category A'});

        await store.dispatch(Actions.patchCategory(category1.id, {
            display_name: 'Category A',
        }));

        expect(getCategory(store.getState(), category1.id)).toMatchObject({
            team_id: teamId,
            type: CategoryTypes.CUSTOM,
            display_name: 'Category A',
            sorting: CategorySorting.Recency,
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category1.id}`).
            reply(200, {...category1, sorting: CategorySorting.Alphabetical});

        await store.dispatch(Actions.patchCategory(category1.id, {
            sorting: CategorySorting.Alphabetical,
        }));

        expect(getCategory(store.getState(), category1.id)).toMatchObject({
            team_id: teamId,
            type: CategoryTypes.CUSTOM,
            display_name: 'Category A',
            sorting: CategorySorting.Alphabetical,
        });

        await store.dispatch(Actions.patchCategory(category1.id, {}));

        expect(getCategory(store.getState(), category1.id)).toMatchObject({
            team_id: teamId,
            type: CategoryTypes.CUSTOM,
            display_name: 'Category A',
            sorting: CategorySorting.Alphabetical,
        });
    });

    test('should patch the category optimistically even when the response is delayed', async () => {
        const store = configureStore(initialState);

        const mock = nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category1.id}`).
            delay(50).
            reply(200, {...category1, display_name: 'Category A'});

        store.dispatch(Actions.patchCategory(category1.id, {
            sorting: CategorySorting.Alphabetical,
        }));

        expect(getCategory(store.getState(), category1.id)).toMatchObject({
            sorting: CategorySorting.Alphabetical,
        });

        await TestHelper.wait(100);

        expect(mock.isDone()).toBe(true);
        expect(getCategory(store.getState(), category1.id)).toMatchObject({
            sorting: CategorySorting.Alphabetical,
        });
    });

    test('should roll back changes with a delayed error response', async () => {
        const store = configureStore(initialState);

        const mock = nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category1.id}`).
            delay(50).
            reply(500, {message: 'test error'});

        store.dispatch(Actions.patchCategory(category1.id, {
            sorting: CategorySorting.Alphabetical,
        }));

        expect(getCategory(store.getState(), category1.id)).toMatchObject({
            sorting: CategorySorting.Alphabetical,
        });

        await TestHelper.wait(100);

        expect(mock.isDone()).toBe(true);
        expect(getCategory(store.getState(), category1.id)).toMatchObject({
            sorting: CategorySorting.Recency,
        });
    });
});

describe('setCategorySorting', () => {
    test('should call the correct API', async () => {
        const currentUserId = TestHelper.generateId();
        const teamId = TestHelper.generateId();

        const category1 = {id: 'category1', team_id: teamId};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        const mock = nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category1.id}`).
            reply(200, {...category1, sorting: CategorySorting.Recency});

        await store.dispatch(Actions.setCategorySorting('category1', CategorySorting.Recency));

        // The response to this is handled in the websocket code, so just confirm that the mock was called correctly
        expect(mock.isDone());
    });
});

describe('setCategoryMuted', () => {
    test('should call the correct API', async () => {
        const currentUserId = TestHelper.generateId();
        const teamId = TestHelper.generateId();

        const category1 = {id: 'category1', team_id: teamId, channel_ids: []};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        const mock = nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category1.id}`).
            reply(200, {...category1, muted: true});

        await store.dispatch(Actions.setCategoryMuted('category1', true));

        // The response to this is handled in the websocket code, so just confirm that the mock was called correctly
        expect(mock.isDone());
    });

    test('should mute the category and all of its channels', async () => {
        const currentUserId = TestHelper.generateId();
        const teamId = TestHelper.generateId();

        const category1 = {
            id: 'category1',
            team_id: teamId,
            channel_ids: ['channel1', 'channel2'],
        };

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                    },
                },
                channels: {
                    myMembers: {
                        channel1: {notify_props: {mark_unread: MarkUnread.ALL}},
                        channel2: {notify_props: {mark_unread: MarkUnread.ALL}},
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category1.id}`).
            reply(200, {...category1, muted: true});

        await store.dispatch(Actions.setCategoryMuted('category1', true));

        const state = store.getState();

        expect(state.entities.channelCategories.byId.category1.muted).toBe(true);
        expect(state.entities.channels.myMembers.channel1.notify_props.mark_unread).toBe(MarkUnread.MENTION);
        expect(state.entities.channels.myMembers.channel2.notify_props.mark_unread).toBe(MarkUnread.MENTION);
    });

    test('should unmute the category and all of its channels', async () => {
        const currentUserId = TestHelper.generateId();
        const teamId = TestHelper.generateId();

        const category1 = {
            id: 'category1',
            team_id: teamId,
            channel_ids: ['channel1', 'channel2'],
            muted: true,
        };

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                    },
                },
                channels: {
                    myMembers: {
                        channel1: {notify_props: {mark_unread: MarkUnread.MENTION}},
                        channel2: {notify_props: {mark_unread: MarkUnread.MENTION}},
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category1.id}`).
            reply(200, {...category1, muted: false});

        await store.dispatch(Actions.setCategoryMuted('category1', false));

        const state = store.getState();

        expect(state.entities.channelCategories.byId.category1.muted).toBe(false);
        expect(state.entities.channels.myMembers.channel1.notify_props.mark_unread).toBe(MarkUnread.ALL);
        expect(state.entities.channels.myMembers.channel2.notify_props.mark_unread).toBe(MarkUnread.ALL);
    });
});

describe('fetchMyCategories', () => {
    test('should populate state correctly', async () => {
        const currentUserId = TestHelper.generateId();
        const teamId = TestHelper.generateId();

        const categories = [
            {
                id: 'category1',
                type: CategoryTypes.FAVORITES,
                team_id: teamId,
            },
            {
                id: 'category2',
                type: CategoryTypes.FAVORITES,
                team_id: teamId,
            },
        ];

        const store = configureStore({
            entities: {
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            get(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, {categories, order: categories.map((category) => category.id)});

        await store.dispatch(Actions.fetchMyCategories(teamId));

        const state = store.getState();
        expect(state.entities.channelCategories.byId.category1).toEqual(categories[0]);
        expect(state.entities.channelCategories.byId.category2).toEqual(categories[1]);
        expect(state.entities.channelCategories.orderByTeam[teamId]).toEqual(['category1', 'category2']);
    });
    test('should update collapse state if it\'s not from websocket', async () => {
        const currentUserId = TestHelper.generateId();
        const teamId = TestHelper.generateId();
        const isWebSocket = false;

        const categories = [
            {
                id: 'category1',
                collapsed: false,
                team_id: teamId,
            },
            {
                id: 'category2',
                collapsed: true,
                team_id: teamId,
            },
        ];

        const store = configureStore({
            entities: {
                users: {
                    currentUserId,
                },
                channelCategories: {
                    byId: {
                        category1: {id: 'category1', team_id: teamId, collapsed: true},
                        category2: {id: 'category2', team_id: teamId, collapsed: false},

                    },
                },
            }});

        nock(Client4.getBaseRoute()).
            get(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, {categories, order: categories.map((category) => category.id)});
        await store.dispatch(Actions.fetchMyCategories(teamId, isWebSocket));
        const categoriesById = getAllCategoriesByIds(store.getState());

        expect(categoriesById.category1.collapsed).toEqual(false);
        expect(categoriesById.category2.collapsed).toEqual(true);
    });
    test('should not update collapse state if it\'s from websocket', async () => {
        const currentUserId = TestHelper.generateId();
        const teamId = TestHelper.generateId();
        const isWebSocket = true;

        const categories = [
            {
                id: 'category1',
                collapsed: false,
                team_id: teamId,
            },
            {
                id: 'category2',
                collapsed: true,
                team_id: teamId,
            },
        ];

        const store = configureStore({
            entities: {
                users: {
                    currentUserId,
                },
                channelCategories: {
                    byId: {
                        category1: {id: 'category1', team_id: teamId, collapsed: true},
                        category2: {id: 'category2', team_id: teamId, collapsed: false},

                    },
                },
            }});
        nock(Client4.getBaseRoute()).
            get(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, {categories, order: categories.map((category) => category.id)});

        await store.dispatch(Actions.fetchMyCategories(teamId, isWebSocket));
        const categoriesById = getAllCategoriesByIds(store.getState());

        expect(categoriesById.category1.collapsed).toEqual(true);
        expect(categoriesById.category2.collapsed).toEqual(false);
    });
});

describe('addChannelToInitialCategory', () => {
    test('should add new DM channel to Direct Messages categories on all teams', () => {
        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        dmCategory1: {id: 'dmCategory1', team_id: 'team1', type: CategoryTypes.DIRECT_MESSAGES, channel_ids: ['dmChannel1', 'dmChannel2']},
                        dmCategory2: {id: 'dmCategory2', team_id: 'team2', type: CategoryTypes.DIRECT_MESSAGES, channel_ids: ['dmChannel1', 'dmChannel2']},
                        channelsCategory1: {id: 'channelsCategory1', team_id: 'team1', type: CategoryTypes.CHANNELS, channel_ids: ['publicChannel1', 'privateChannel1']},
                    },
                },
            },
        });

        const newDmChannel = {id: 'newDmChannel', type: General.DM_CHANNEL};

        store.dispatch(Actions.addChannelToInitialCategory(newDmChannel));

        const categoriesById = getAllCategoriesByIds(store.getState());
        expect(categoriesById.dmCategory1.channel_ids).toEqual(['newDmChannel', 'dmChannel1', 'dmChannel2']);
        expect(categoriesById.dmCategory2.channel_ids).toEqual(['newDmChannel', 'dmChannel1', 'dmChannel2']);
        expect(categoriesById.channelsCategory1.channel_ids).not.toContain('newDmChannel');
    });

    test('should do nothing if categories have not been loaded yet for the given team', () => {
        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        channelsCategory1: {id: 'channelsCategory1', team_id: 'team1', type: CategoryTypes.DIRECT_MESSAGES, channel_ids: ['publicChannel1', 'privateChannel1']},
                    },
                    orderByTeam: {
                        team1: ['channelsCategory1'],
                    },
                },
            },
        });

        const publicChannel1 = {id: 'publicChannel1', type: General.OPEN_CHANNEL, team_id: 'team2'};

        store.dispatch(Actions.addChannelToInitialCategory(publicChannel1));

        const categoriesById = getAllCategoriesByIds(store.getState());
        expect(categoriesById.channelsCategory1.channel_ids).toEqual(['publicChannel1', 'privateChannel1']);
    });

    test('should add new channel to Channels category', () => {
        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        channelsCategory1: {id: 'channelsCategory1', team_id: 'team1', type: CategoryTypes.CHANNELS, channel_ids: ['publicChannel1', 'privateChannel1']},
                        dmCategory1: {id: 'dmCategory1', team_id: 'team1', type: CategoryTypes.DIRECT_MESSAGES, channel_ids: ['dmChannel1', 'dmChannel2']},
                        channelsCategory2: {id: 'channelsCategory2', team_id: 'team2', type: CategoryTypes.CHANNELS, channel_ids: ['publicChannel2', 'privateChannel2']},
                    },
                    orderByTeam: {
                        team1: ['channelsCategory1', 'dmCategory1'],
                        team2: ['channelsCategory2'],
                    },
                },
            },
        });

        const newChannel = {id: 'newChannel', type: General.OPEN_CHANNEL, team_id: 'team1'};

        store.dispatch(Actions.addChannelToInitialCategory(newChannel));

        const categoriesById = getAllCategoriesByIds(store.getState());
        expect(categoriesById.channelsCategory1.channel_ids).toEqual(['newChannel', 'publicChannel1', 'privateChannel1']);
        expect(categoriesById.dmCategory1.channel_ids).not.toContain('newChannel');
        expect(categoriesById.channelsCategory2.channel_ids).not.toContain('newChannel');
    });

    test('should not add duplicate channel to Channels category', () => {
        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        channelsCategory1: {id: 'channelsCategory1', team_id: 'team1', type: CategoryTypes.CHANNELS, channel_ids: ['publicChannel1', 'privateChannel1']},
                    },
                    orderByTeam: {
                        team1: ['channelsCategory1'],
                    },
                },
            },
        });

        const publicChannel1 = {id: 'publicChannel1', type: General.OPEN_CHANNEL, team_id: 'team1'};

        store.dispatch(Actions.addChannelToInitialCategory(publicChannel1));

        const categoriesById = getAllCategoriesByIds(store.getState());
        expect(categoriesById.channelsCategory1.channel_ids).toEqual(['publicChannel1', 'privateChannel1']);
    });

    test('should not add GM channel to DIRECT_MESSAGES categories on team if it exists in a category', () => {
        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        dmCategory1: {id: 'dmCategory1', team_id: 'team1', type: CategoryTypes.DIRECT_MESSAGES, channel_ids: ['dmChannel1', 'dmChannel2']},
                        dmCategory2: {id: 'dmCategory2', team_id: 'team2', type: CategoryTypes.DIRECT_MESSAGES, channel_ids: ['dmChannel1', 'dmChannel2']},
                        channelsCategory1: {id: 'custom', team_id: 'team1', type: CategoryTypes.CUSTOM, channel_ids: ['publicChannel1', 'gmChannel']},
                    },
                },
            },
        });

        const newDmChannel = {id: 'gmChannel', type: General.GM_CHANNEL};

        store.dispatch(Actions.addChannelToInitialCategory(newDmChannel));

        const categoriesById = getAllCategoriesByIds(store.getState());
        expect(categoriesById.dmCategory1.channel_ids).toEqual(['dmChannel1', 'dmChannel2']);
        expect(categoriesById.dmCategory2.channel_ids).toEqual(['gmChannel', 'dmChannel1', 'dmChannel2']);
        expect(categoriesById.channelsCategory1.channel_ids).toEqual(['publicChannel1', 'gmChannel']);
    });
});

describe('addChannelToCategory', () => {
    const currentUserId = TestHelper.generateId();
    const teamId = TestHelper.generateId();

    test('should add the channel to the given category', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
        const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Default};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        category2,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel5', 'channel1', 'channel2']}]);

        await store.dispatch(Actions.addChannelToCategory('category1', 'channel5'));

        const state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel5', 'channel1', 'channel2']);
        expect(state.entities.channelCategories.byId.category2).toBe(category2);

        // Also should not change the sort order of the category
        expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Default);
    });

    test('should remove the channel from its previous category', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
        const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Default};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        category2,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...category1, channel_ids: ['channel3', 'channel1', 'channel2']},
                {...category2, channel_ids: ['channel4']},
            ]);

        await store.dispatch(Actions.addChannelToCategory('category1', 'channel3'));

        const state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel3', 'channel1', 'channel2']);
        expect(state.entities.channelCategories.byId.category2.channel_ids).toEqual(['channel4']);

        // Also should not change the sort order of either category
        expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Default);
        expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Default);
    });
});

describe('moveChannelToCategory', () => {
    const currentUserId = TestHelper.generateId();
    const teamId = TestHelper.generateId();

    test('should add the channel to the given category at the correct index', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2']};
        const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4']};
        const otherTeamCategory = {id: 'otherTeamCategory', team_id: 'team2', channel_ids: ['channel1', 'channel2']};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        category2,
                        otherTeamCategory,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel1', 'channel5', 'channel2']}]);

        await store.dispatch(Actions.moveChannelToCategory('category1', 'channel5', 1));

        let state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel1', 'channel5', 'channel2']);
        expect(state.entities.channelCategories.byId.category2).toBe(category2);
        expect(state.entities.channelCategories.byId.otherTeamCategory).toBe(otherTeamCategory);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel1', 'channel5', 'channel6', 'channel2']}]);

        await store.dispatch(Actions.moveChannelToCategory('category1', 'channel6', 2));

        state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel1', 'channel5', 'channel6', 'channel2']);
        expect(state.entities.channelCategories.byId.category2).toBe(category2);
        expect(state.entities.channelCategories.byId.otherTeamCategory).toBe(otherTeamCategory);
    });

    test('should remove the channel from its previous category', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2']};
        const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4']};
        const otherTeamCategory = {id: 'otherTeamCategory', team_id: 'team2', channel_ids: ['channel1', 'channel2']};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        category2,
                        otherTeamCategory,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...category1, channel_ids: ['channel2']},
                {...category2, channel_ids: ['channel3', 'channel4', 'channel1']},
            ]);

        await store.dispatch(Actions.moveChannelToCategory('category2', 'channel1', 2));

        const state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel2']);
        expect(state.entities.channelCategories.byId.category2.channel_ids).toEqual(['channel3', 'channel4', 'channel1']);
        expect(state.entities.channelCategories.byId.otherTeamCategory).toBe(otherTeamCategory);
    });

    test('should move channel within its current category', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2', 'channel3', 'channel4', 'channel5']};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel1', 'channel5', 'channel2', 'channel3', 'channel4']}]);

        await store.dispatch(Actions.moveChannelToCategory('category1', 'channel5', 1));

        let state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel1', 'channel5', 'channel2', 'channel3', 'channel4']);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel5', 'channel2', 'channel3', 'channel1', 'channel4']}]);

        await store.dispatch(Actions.moveChannelToCategory('category1', 'channel1', 3));

        state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel5', 'channel2', 'channel3', 'channel1', 'channel4']);
    });

    test('moving a channel to the favorites category should also favorite the channel in preferences', async () => {
        const favoritesCategory = {id: 'favoritesCategory', team_id: teamId, type: CategoryTypes.FAVORITES, channel_ids: []};
        const otherCategory = {id: 'otherCategory', team_id: teamId, type: CategoryTypes.CUSTOM, channel_ids: ['channel1']};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        favoritesCategory,
                        otherCategory,
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId,
                },
                channels: {
                    channels: {
                        channel1: {
                            id: 'channel1',
                            team_id: teamId,
                        },
                        channel2: {
                            id: 'channel2',
                            team_id: teamId,
                        },
                    },
                },
            },
        });

        let state = store.getState();

        expect(isFavoriteChannel(state, 'channel1')).toBe(false);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...favoritesCategory, channel_ids: ['channel1']},
                {...otherCategory, channel_ids: []},
            ]);

        // Move the channel into favorites
        await store.dispatch(Actions.moveChannelToCategory('favoritesCategory', 'channel1', 0));

        state = store.getState();

        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual(['channel1']);
        expect(state.entities.channelCategories.byId.otherCategory.channel_ids).toEqual([]);
        expect(isFavoriteChannel(state, 'channel1')).toBe(true);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...favoritesCategory, channel_ids: []},
                {...otherCategory, channel_ids: ['channel1']},
            ]);

        // And back out
        await store.dispatch(Actions.moveChannelToCategory('otherCategory', 'channel1', 0));

        state = store.getState();

        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual([]);
        expect(state.entities.channelCategories.byId.otherCategory.channel_ids).toEqual(['channel1']);
        expect(isFavoriteChannel(state, 'channel1')).toBe(false);
    });

    describe('changes to sorting method', () => {
        test('if the category was sorted by default, should set the destination category to manual sorting', async () => {
            const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
            const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Default};

            const store = configureStore({
                entities: {
                    channelCategories: {
                        byId: {
                            category1,
                            category2,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                },
            });

            nock(Client4.getBaseRoute()).
                put(`/users/${currentUserId}/teams/${teamId}/channels/categories`, (body) => {
                    return body.find((category) => category.id === 'category1').sorting !== CategorySorting.Manual &&
                        body.find((category) => category.id === 'category2').sorting === CategorySorting.Manual;
                }).
                reply(200, [
                    {...category1, channel_ids: ['channel2']},
                    {...category2, channel_ids: ['channel1', 'channel3', 'channel4'], sorting: CategorySorting.Manual},
                ]);

            await store.dispatch(Actions.moveChannelToCategory(category2.id, 'channel1', 0));

            let state = store.getState();
            expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Default);
            expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Manual);

            nock(Client4.getBaseRoute()).
                put(`/users/${currentUserId}/teams/${teamId}/channels/categories`, (body) => {
                    return body.find((category) => category.id === 'category1').sorting === CategorySorting.Manual &&
                        body.find((category) => category.id === 'category2').sorting === CategorySorting.Manual;
                }).
                reply(200, [
                    {...category1, channel_ids: ['channel2', 'channel1'], sorting: CategorySorting.Manual},
                    {...category2, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Manual},
                ]);

            await store.dispatch(Actions.moveChannelToCategory(category1.id, 'channel1', 2));

            state = store.getState();
            expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Manual);
            expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Manual);
        });

        test('if the category was sorted automatically, should not change the sorting method', async () => {
            const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Alphabetical};
            const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Recency};

            const store = configureStore({
                entities: {
                    channelCategories: {
                        byId: {
                            category1,
                            category2,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                },
            });

            nock(Client4.getBaseRoute()).
                put(`/users/${currentUserId}/teams/${teamId}/channels/categories`, (body) => {
                    return body.find((category) => category.id === 'category1').sorting !== CategorySorting.Manual &&
                        body.find((category) => category.id === 'category2').sorting !== CategorySorting.Manual;
                }).
                reply(200, [
                    {...category1, channel_ids: ['channel2']},
                    {...category2, channel_ids: ['channel1', 'channel3', 'channel4']},
                ]);

            await store.dispatch(Actions.moveChannelToCategory(category2.id, 'channel1', 0));

            let state = store.getState();
            expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Alphabetical);
            expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Recency);

            nock(Client4.getBaseRoute()).
                put(`/users/${currentUserId}/teams/${teamId}/channels/categories`, (body) => {
                    return body.find((category) => category.id === 'category1').sorting !== CategorySorting.Manual &&
                        body.find((category) => category.id === 'category2').sorting !== CategorySorting.Manual;
                }).
                reply(200, [
                    {...category1, channel_ids: ['channel2', 'channel1']},
                    {...category2, channel_ids: ['channel3', 'channel4']},
                ]);

            await store.dispatch(Actions.moveChannelToCategory(category1.id, 'channel1', 2));

            state = store.getState();
            expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Alphabetical);
            expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Recency);
        });
    });

    test('should optimistically update the modified categories', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
        const favoritesCategory = {id: 'favoritesCategory', type: CategoryTypes.FAVORITES, team_id: teamId, channel_ids: [], sorting: CategorySorting.Default};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        favoritesCategory,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            delayBody(100).
            reply(200, [
                {...category1, channel_ids: ['channel2']},
                {...favoritesCategory, channel_ids: ['channel1'], sorting: CategorySorting.Manual},
            ]);

        const moveRequest = store.dispatch(Actions.moveChannelToCategory(favoritesCategory.id, 'channel1', 0));

        // At this point, the category should have already been optimistically updated, but the favorites preferences
        // won't be updated until after the request completes
        let state = store.getState();
        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel2']);
        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual(['channel1']);

        await moveRequest;

        // And now that the request has finished, the favorites should have been updated
        state = store.getState();
        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel2']);
        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual(['channel1']);
    });

    test('should optimistically update the modified categories', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
        const favoritesCategory = {id: 'favoritesCategory', type: CategoryTypes.FAVORITES, team_id: teamId, channel_ids: [], sorting: CategorySorting.Default};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        favoritesCategory,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            delayBody(100).
            reply(400);

        const moveRequest = store.dispatch(Actions.moveChannelToCategory(favoritesCategory.id, 'channel1', 0));

        // At this point, the category should have already been optimistically updated, even though it will fail
        let state = store.getState();
        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel2']);
        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual(['channel1']);

        await moveRequest;

        // And now that the request has finished, the changes should've been rolled back
        state = store.getState();
        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel1', 'channel2']);
        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual([]);
    });
});

describe('moveCategory', () => {
    const currentUserId = TestHelper.generateId();

    test('should call the correct API', async () => {
        const store = configureStore({
            entities: {
                channelCategories: {
                    orderByTeam: {
                        team1: ['category1', 'category2', 'category3', 'category4'],
                        team2: ['category5', 'category6'],
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        const mock = nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/team1/channels/categories/order`).
            reply(200, ['category2', 'category3', 'category4', 'category1']);

        await store.dispatch(Actions.moveCategory('team1', 'category1', 3));

        // The response to this is handled in the websocket code, so just confirm that the mock was called correctly
        expect(mock.isDone());
    });
});

describe('moveChannelsToCategory', () => {
    const currentUserId = TestHelper.generateId();
    const teamId = TestHelper.generateId();

    test('should add channels to the given category at the correct index', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2']};
        const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4']};
        const otherTeamCategory = {id: 'otherTeamCategory', team_id: 'team2', channel_ids: ['channel1', 'channel2']};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        category2,
                        otherTeamCategory,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel1', 'channel5', 'channel6', 'channel2']}]);

        await store.dispatch(Actions.moveChannelsToCategory('category1', ['channel5', 'channel6'], 1));

        let state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel1', 'channel5', 'channel6', 'channel2']);
        expect(state.entities.channelCategories.byId.category2).toBe(category2);
        expect(state.entities.channelCategories.byId.otherTeamCategory).toBe(otherTeamCategory);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel1', 'channel5', 'channel6', 'channel7', 'channel8', 'channel2']}]);

        await store.dispatch(Actions.moveChannelsToCategory('category1', ['channel7', 'channel8'], 3));

        state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel1', 'channel5', 'channel6', 'channel7', 'channel8', 'channel2']);
        expect(state.entities.channelCategories.byId.category2).toBe(category2);
        expect(state.entities.channelCategories.byId.otherTeamCategory).toBe(otherTeamCategory);
    });

    test('should remove the channels from their previous category', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2', 'channel3']};
        const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel4', 'channel5', 'channel6']};
        const otherTeamCategory = {id: 'otherTeamCategory', team_id: 'team2', channel_ids: ['channel1', 'channel2']};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        category2,
                        otherTeamCategory,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...category1, channel_ids: ['channel2']},
                {...category2, channel_ids: ['channel4', 'channel5', 'channel6', 'channel1', 'channel3']},
            ]);

        await store.dispatch(Actions.moveChannelsToCategory('category2', ['channel1', 'channel3'], 3));

        const state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel2']);
        expect(state.entities.channelCategories.byId.category2.channel_ids).toEqual(['channel4', 'channel5', 'channel6', 'channel1', 'channel3']);
        expect(state.entities.channelCategories.byId.otherTeamCategory).toBe(otherTeamCategory);
    });

    test('should move channel within its current category', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2', 'channel3', 'channel4', 'channel5']};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel1', 'channel5', 'channel3', 'channel2', 'channel4']}]);

        await store.dispatch(Actions.moveChannelsToCategory('category1', ['channel5', 'channel3'], 1));

        let state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel1', 'channel5', 'channel3', 'channel2', 'channel4']);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [{...category1, channel_ids: ['channel5', 'channel3', 'channel2', 'channel1', 'channel4']}]);

        await store.dispatch(Actions.moveChannelsToCategory('category1', ['channel1', 'channel4'], 3));

        state = store.getState();

        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel5', 'channel3', 'channel2', 'channel1', 'channel4']);
    });

    test('moving a channel to the favorites category should also favorite the channel in preferences', async () => {
        const favoritesCategory = {id: 'favoritesCategory', team_id: teamId, type: CategoryTypes.FAVORITES, channel_ids: []};
        const otherCategory = {id: 'otherCategory', team_id: teamId, type: CategoryTypes.CUSTOM, channel_ids: ['channel1', 'channel2']};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        favoritesCategory,
                        otherCategory,
                    },
                },
                preferences: {
                    myPreferences: {},
                },
                users: {
                    currentUserId,
                },
                channels: {
                    channels: {
                        channel1: {
                            id: 'channel1',
                            team_id: teamId,
                        },
                        channel2: {
                            id: 'channel2',
                            team_id: teamId,
                        },
                    },
                },
            },
        });

        let state = store.getState();

        expect(isFavoriteChannel(state, 'channel1')).toBe(false);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...favoritesCategory, channel_ids: ['channel1', 'channel2']},
                {...otherCategory, channel_ids: []},
            ]);

        // Move the channel into favorites
        await store.dispatch(Actions.moveChannelsToCategory('favoritesCategory', ['channel1', 'channel2'], 0));

        state = store.getState();

        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual(['channel1', 'channel2']);
        expect(state.entities.channelCategories.byId.otherCategory.channel_ids).toEqual([]);
        expect(isFavoriteChannel(state, 'channel1')).toBe(true);
        expect(isFavoriteChannel(state, 'channel2')).toBe(true);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...favoritesCategory, channel_ids: []},
                {...otherCategory, channel_ids: ['channel1']},
            ]);

        // And back out
        await store.dispatch(Actions.moveChannelsToCategory('otherCategory', ['channel1', 'channel2'], 0));

        state = store.getState();

        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual([]);
        expect(state.entities.channelCategories.byId.otherCategory.channel_ids).toEqual(['channel1', 'channel2']);
        expect(isFavoriteChannel(state, 'channel1')).toBe(false);
        expect(isFavoriteChannel(state, 'channel2')).toBe(false);
    });

    describe('changes to sorting method', () => {
        test('if the category was sorted by default, should set the destination category to manual sorting', async () => {
            const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
            const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Default};

            const store = configureStore({
                entities: {
                    channelCategories: {
                        byId: {
                            category1,
                            category2,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                },
            });

            nock(Client4.getBaseRoute()).
                put(`/users/${currentUserId}/teams/${teamId}/channels/categories`, (body) => {
                    return body.find((category) => category.id === 'category1').sorting !== CategorySorting.Manual &&
                        body.find((category) => category.id === 'category2').sorting === CategorySorting.Manual;
                }).
                reply(200, [
                    {...category1, channel_ids: ['channel2']},
                    {...category2, channel_ids: ['channel1', 'channel3', 'channel4'], sorting: CategorySorting.Manual},
                ]);

            await store.dispatch(Actions.moveChannelsToCategory(category2.id, ['channel1'], 0));

            let state = store.getState();
            expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Default);
            expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Manual);

            nock(Client4.getBaseRoute()).
                put(`/users/${currentUserId}/teams/${teamId}/channels/categories`, (body) => {
                    return body.find((category) => category.id === 'category1').sorting === CategorySorting.Manual &&
                        body.find((category) => category.id === 'category2').sorting === CategorySorting.Manual;
                }).
                reply(200, [
                    {...category1, channel_ids: ['channel2', 'channel1'], sorting: CategorySorting.Manual},
                    {...category2, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Manual},
                ]);

            await store.dispatch(Actions.moveChannelsToCategory(category1.id, ['channel1'], 2));

            state = store.getState();
            expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Manual);
            expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Manual);
        });

        test('if the category was sorted automatically, should not change the sorting method', async () => {
            const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Alphabetical};
            const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Recency};

            const store = configureStore({
                entities: {
                    channelCategories: {
                        byId: {
                            category1,
                            category2,
                        },
                    },
                    users: {
                        currentUserId,
                    },
                },
            });

            nock(Client4.getBaseRoute()).
                put(`/users/${currentUserId}/teams/${teamId}/channels/categories`, (body) => {
                    return body.find((category) => category.id === 'category1').sorting !== CategorySorting.Manual &&
                        body.find((category) => category.id === 'category2').sorting !== CategorySorting.Manual;
                }).
                reply(200, [
                    {...category1, channel_ids: ['channel2']},
                    {...category2, channel_ids: ['channel1', 'channel3', 'channel4']},
                ]);

            await store.dispatch(Actions.moveChannelsToCategory(category2.id, ['channel1'], 0));

            let state = store.getState();
            expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Alphabetical);
            expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Recency);

            nock(Client4.getBaseRoute()).
                put(`/users/${currentUserId}/teams/${teamId}/channels/categories`, (body) => {
                    return body.find((category) => category.id === 'category1').sorting !== CategorySorting.Manual &&
                        body.find((category) => category.id === 'category2').sorting !== CategorySorting.Manual;
                }).
                reply(200, [
                    {...category1, channel_ids: ['channel2', 'channel1']},
                    {...category2, channel_ids: ['channel3', 'channel4']},
                ]);

            await store.dispatch(Actions.moveChannelsToCategory(category1.id, ['channel1'], 2));

            state = store.getState();
            expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Alphabetical);
            expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Recency);
        });
    });
    test('should set the destination category to manual sorting', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
        const category2 = {id: 'category2', team_id: teamId, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Default};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        category2,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...category1, channel_ids: ['channel2']},
                {...category2, channel_ids: ['channel1', 'channel3', 'channel4'], sorting: CategorySorting.Manual},
            ]);

        await store.dispatch(Actions.moveChannelsToCategory(category2.id, ['channel1'], 0));

        let state = store.getState();
        expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Default);
        expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Manual);

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, [
                {...category1, channel_ids: ['channel2', 'channel1'], sorting: CategorySorting.Manual},
                {...category2, channel_ids: ['channel3', 'channel4'], sorting: CategorySorting.Manual},
            ]);

        await store.dispatch(Actions.moveChannelsToCategory(category1.id, ['channel1'], 2));

        state = store.getState();
        expect(state.entities.channelCategories.byId.category1.sorting).toBe(CategorySorting.Manual);
        expect(state.entities.channelCategories.byId.category2.sorting).toBe(CategorySorting.Manual);
    });

    test('should optimistically update the modified categories', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
        const favoritesCategory = {id: 'favoritesCategory', type: CategoryTypes.FAVORITES, team_id: teamId, channel_ids: [], sorting: CategorySorting.Default};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        favoritesCategory,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            delayBody(100).
            reply(200, [
                {...category1, channel_ids: ['channel2']},
                {...favoritesCategory, channel_ids: ['channel1'], sorting: CategorySorting.Manual},
            ]);

        const moveRequest = store.dispatch(Actions.moveChannelsToCategory(favoritesCategory.id, ['channel1'], 0));

        // At this point, the category should have already been optimistically updated, but the favorites preferences
        // won't be updated until after the request completes
        let state = store.getState();
        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel2']);
        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual(['channel1']);

        await moveRequest;

        // And now that the request has finished, the favorites should have been updated
        state = store.getState();
        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel2']);
        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual(['channel1']);
    });

    test('should optimistically update the modified categories - failure case', async () => {
        const category1 = {id: 'category1', team_id: teamId, channel_ids: ['channel1', 'channel2'], sorting: CategorySorting.Default};
        const favoritesCategory = {id: 'favoritesCategory', type: CategoryTypes.FAVORITES, team_id: teamId, channel_ids: [], sorting: CategorySorting.Default};

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1,
                        favoritesCategory,
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            delayBody(100).
            reply(400);

        const moveRequest = store.dispatch(Actions.moveChannelsToCategory(favoritesCategory.id, ['channel1'], 0));

        // At this point, the category should have already been optimistically updated, even though it will fail
        let state = store.getState();
        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel2']);
        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual(['channel1']);

        await moveRequest;

        // And now that the request has finished, the changes should've been rolled back
        state = store.getState();
        expect(state.entities.channelCategories.byId.category1.channel_ids).toEqual(['channel1', 'channel2']);
        expect(state.entities.channelCategories.byId.favoritesCategory.channel_ids).toEqual([]);
    });
});

describe('createCategory', () => {
    const currentUserId = TestHelper.generateId();
    const teamId = TestHelper.generateId();
    const categoryName = 'new category';

    test('should call the correct API', async () => {
        const store = configureStore({
            entities: {
                channelCategories: {
                    orderByTeam: {
                        [teamId]: [],
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        const mock = nock(Client4.getBaseRoute()).
            post(`/users/${currentUserId}/teams/${teamId}/channels/categories`).
            reply(200, {
                display_name: categoryName,
                team_id: teamId,
                channel_ids: [],
            });

        await store.dispatch(Actions.createCategory(teamId, categoryName));

        // The response to this is handled in the websocket code, so just confirm that the mock was called correctly
        expect(mock.isDone());
    });
});

describe('renameCategory', () => {
    const currentUserId = TestHelper.generateId();
    const teamId = TestHelper.generateId();

    test('should call the correct API', async () => {
        const category = {
            id: TestHelper.generateId(),
            display_name: 'original name',
        };

        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        [category.id]: category,
                    },
                    orderByTeam: {
                        [teamId]: [category.id],
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        const mock = nock(Client4.getBaseRoute()).
            put(`/users/${currentUserId}/teams/${teamId}/channels/categories/${category.id}`).
            reply(200, {...category, display_name: 'new name'});

        await store.dispatch(Actions.renameCategory(category.id, 'new name'));

        // The response to this is handled in the websocket code, so just confirm that the mock was called correctly
        expect(mock.isDone());
    });
});

describe('deleteCategory', () => {
    const currentUserId = TestHelper.generateId();
    const teamId = TestHelper.generateId();

    test('should call the correct API', async () => {
        const store = configureStore({
            entities: {
                channelCategories: {
                    byId: {
                        category1: {id: 'category1', team_id: teamId, channel_ids: []},
                        category2: {id: 'category2', team_id: teamId, channel_ids: []},
                        category3: {id: 'category3', team_id: teamId, channel_ids: []},
                        category4: {id: 'category4', team_id: teamId, channel_ids: []},
                    },
                    orderByTeam: {
                        [teamId]: ['category1', 'category2', 'category3', 'category4'],
                    },
                },
                users: {
                    currentUserId,
                },
            },
        });

        const mock = nock(Client4.getBaseRoute()).
            delete(`/users/${currentUserId}/teams/${teamId}/channels/categories/category3`).
            reply(200, OK_RESPONSE);

        await store.dispatch(Actions.deleteCategory('category3'));

        // The response to this is handled in the websocket code, so just confirm that the mock was called correctly
        expect(mock.isDone());
    });
});
