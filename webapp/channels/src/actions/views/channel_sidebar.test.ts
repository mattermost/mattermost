// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CategorySorting} from '@mattermost/types/channel_categories';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';
import type {DeepPartial} from '@mattermost/types/utilities';

import {insertWithoutDuplicates} from 'mattermost-redux/utils/array_utils';

import configureStore from 'store';

import type {GlobalState} from 'types/store';

import * as Actions from './channel_sidebar';

describe('adjustTargetIndexForMove', () => {
    const channelIds = ['one', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'seven'];

    const initialState = {
        entities: {
            channelCategories: {
                byId: {
                    category1: {
                        id: 'category1',
                        channel_ids: channelIds,
                        sorting: CategorySorting.Manual,
                    },
                },
            },
            channels: {
                channels: {
                    new: {id: 'new', delete_at: 0},
                    one: {id: 'one', delete_at: 0},
                    twoDeleted: {id: 'twoDeleted', delete_at: 1},
                    three: {id: 'three', delete_at: 0},
                    four: {id: 'four', delete_at: 0},
                    fiveDeleted: {id: 'fiveDeleted', delete_at: 1},
                    six: {id: 'six', delete_at: 0},
                    seven: {id: 'seven', delete_at: 0},
                },
            },
        },
    };

    describe('should place newly added channels correctly in the category', () => {
        const testCases = [
            {
                inChannelIds: ['new', 'one', 'three', 'four', 'six', 'seven'],
                expectedChannelIds: ['new', 'one', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'seven'],
            },
            {
                inChannelIds: ['one', 'new', 'three', 'four', 'six', 'seven'],
                expectedChannelIds: ['one', 'new', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'seven'],
            },
            {
                inChannelIds: ['one', 'three', 'new', 'four', 'six', 'seven'],
                expectedChannelIds: ['one', 'twoDeleted', 'three', 'new', 'four', 'fiveDeleted', 'six', 'seven'],
            },
            {
                inChannelIds: ['one', 'three', 'four', 'new', 'six', 'seven'],
                expectedChannelIds: ['one', 'twoDeleted', 'three', 'four', 'new', 'fiveDeleted', 'six', 'seven'],
            },
            {
                inChannelIds: ['one', 'three', 'four', 'six', 'new', 'seven'],
                expectedChannelIds: ['one', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'new', 'seven'],
            },
            {
                inChannelIds: ['one', 'three', 'four', 'six', 'seven', 'new'],
                expectedChannelIds: ['one', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'seven', 'new'],
            },
        ];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            test('at ' + i, async () => {
                const store = configureStore(initialState);

                const targetIndex = testCase.inChannelIds.indexOf('new');

                const newIndex = Actions.adjustTargetIndexForMove(store.getState(), 'category1', ['new'], targetIndex, 'new');

                const actualChannelIds = insertWithoutDuplicates(channelIds, 'new', newIndex);
                expect(actualChannelIds).toEqual(testCase.expectedChannelIds);
            });
        }
    });

    describe('should be able to move channels forwards', () => {
        const testCases = [
            {
                inChannelIds: ['one', 'three', 'four', 'six', 'seven'],
                expectedChannelIds: ['one', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'seven'],
            },
            {
                inChannelIds: ['three', 'one', 'four', 'six', 'seven'],
                expectedChannelIds: ['twoDeleted', 'three', 'one', 'four', 'fiveDeleted', 'six', 'seven'],
            },
            {
                inChannelIds: ['three', 'four', 'one', 'six', 'seven'],
                expectedChannelIds: ['twoDeleted', 'three', 'four', 'one', 'fiveDeleted', 'six', 'seven'],
            },
            {
                inChannelIds: ['three', 'four', 'six', 'one', 'seven'],
                expectedChannelIds: ['twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'one', 'seven'],
            },
            {
                inChannelIds: ['three', 'four', 'six', 'seven', 'one'],
                expectedChannelIds: ['twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'seven', 'one'],
            },
        ];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            test('at ' + i, async () => {
                const store = configureStore(initialState);

                const targetIndex = testCase.inChannelIds.indexOf('one');

                const newIndex = Actions.adjustTargetIndexForMove(store.getState(), 'category1', ['one'], targetIndex, 'one');

                const actualChannelIds = insertWithoutDuplicates(channelIds, 'one', newIndex);
                expect(actualChannelIds).toEqual(testCase.expectedChannelIds);
            });
        }
    });

    describe('should be able to move channels backwards', () => {
        const testCases = [
            {
                inChannelIds: ['one', 'three', 'four', 'six', 'seven'],
                expectedChannelIds: ['one', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six', 'seven'],
            },
            {
                inChannelIds: ['one', 'three', 'four', 'seven', 'six'],
                expectedChannelIds: ['one', 'twoDeleted', 'three', 'four', 'seven', 'fiveDeleted', 'six'],
            },
            {
                inChannelIds: ['one', 'three', 'seven', 'four', 'six'],
                expectedChannelIds: ['one', 'twoDeleted', 'three', 'seven', 'four', 'fiveDeleted', 'six'],
            },
            {
                inChannelIds: ['one', 'seven', 'three', 'four', 'six'],
                expectedChannelIds: ['one', 'seven', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six'],
            },
            {
                inChannelIds: ['seven', 'one', 'three', 'four', 'six'],
                expectedChannelIds: ['seven', 'one', 'twoDeleted', 'three', 'four', 'fiveDeleted', 'six'],
            },
        ];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            test('at ' + i, async () => {
                const store = configureStore(initialState);

                const targetIndex = testCase.inChannelIds.indexOf('seven');

                const newIndex = Actions.adjustTargetIndexForMove(store.getState(), 'category1', ['seven'], targetIndex, 'seven');

                const actualChannelIds = insertWithoutDuplicates(channelIds, 'seven', newIndex);
                expect(actualChannelIds).toEqual(testCase.expectedChannelIds);
            });
        }
    });
});

describe('multiSelectChannelTo', () => {
    const channelIds = ['one', 'two', 'three', 'four', 'five', 'six', 'seven'];

    const initialState = {
        entities: {
            users: {
                currentUserId: 'user',
            },
            channelCategories: {
                byId: {
                    category1: {
                        id: 'category1',
                        channel_ids: channelIds.map((id) => `category1_${id}`),
                        sorting: CategorySorting.Manual,
                    },
                    category2: {
                        id: 'category2',
                        channel_ids: channelIds.map((id) => `category2_${id}`),
                        sorting: CategorySorting.Manual,
                    },
                },
                orderByTeam: {
                    team1: ['category1', 'category2'],
                },
            },
            channels: {
                currentChannelId: 'category1_one',
                channels: {
                    ...channelIds.reduce((init: {[key: string]: Partial<Channel>}, val) => {
                        init[`category1_${val}`] = {id: `category1_${val}`, delete_at: 0};
                        return init;
                    }, {}),
                    ...channelIds.reduce((init: {[key: string]: Partial<Channel>}, val) => {
                        init[`category2_${val}`] = {id: `category2_${val}`, delete_at: 0};
                        return init;
                    }, {}),
                },
                myMembers: {
                    ...channelIds.reduce((init: {[key: string]: Partial<ChannelMembership>}, val) => {
                        init[`category1_${val}`] = {channel_id: `category1_${val}`, user_id: 'user'};
                        return init;
                    }, {}),
                    ...channelIds.reduce((init: {[key: string]: Partial<ChannelMembership>}, val) => {
                        init[`category2_${val}`] = {channel_id: `category2_${val}`, user_id: 'user'};
                        return init;
                    }, {}),
                },
                channelsInTeam: {
                    team1: new Set(channelIds.map((id) => `category1_${id}`).concat(channelIds.map((id) => `category2_${id}`))),
                },
            },
            teams: {
                currentTeamId: 'team1',
            },
        },
        views: {
            channelSidebar: {
                multiSelectedChannelIds: [],
                lastSelectedChannel: '',
            },
        },
    };

    test('should only select current channel if is selected ID and none other are selected', () => {
        const store = configureStore(initialState);

        store.dispatch(Actions.multiSelectChannelTo('category1_one'));

        expect(store.getState().views.channelSidebar.multiSelectedChannelIds).toEqual(['category1_one']);
    });

    test('should select group of channels in ascending order', () => {
        const store = configureStore({
            ...initialState,
            views: {
                channelSidebar: {
                    multiSelectedChannelIds: ['category1_two'],
                    lastSelectedChannel: 'category1_two',
                },
            },
        });

        store.dispatch(Actions.multiSelectChannelTo('category1_seven'));

        expect(store.getState().views.channelSidebar.multiSelectedChannelIds).toEqual(['category1_two', 'category1_three', 'category1_four', 'category1_five', 'category1_six', 'category1_seven']);
    });

    test('should select group of channels in descending order and sort by ascending', () => {
        const store = configureStore({
            ...initialState,
            views: {
                channelSidebar: {
                    multiSelectedChannelIds: ['category1_five'],
                    lastSelectedChannel: 'category1_five',
                },
            },
        });

        store.dispatch(Actions.multiSelectChannelTo('category1_one'));

        expect(store.getState().views.channelSidebar.multiSelectedChannelIds).toEqual(['category1_one', 'category1_two', 'category1_three', 'category1_four', 'category1_five']);
    });

    test('should select group of channels where some other channels were already selected', () => {
        const store = configureStore({
            ...initialState,
            views: {
                channelSidebar: {
                    multiSelectedChannelIds: ['category1_five', 'category2_six', 'category2_three'],
                    lastSelectedChannel: 'category1_five',
                },
            },
        });

        store.dispatch(Actions.multiSelectChannelTo('category1_one'));

        expect(store.getState().views.channelSidebar.multiSelectedChannelIds).toEqual(['category1_one', 'category1_two', 'category1_three', 'category1_four', 'category1_five']);
    });

    test('should select group of channels where some other channels were already selected but in new selection', () => {
        const store = configureStore({
            ...initialState,
            views: {
                channelSidebar: {
                    multiSelectedChannelIds: ['category1_five', 'category1_three', 'category1_one'],
                    lastSelectedChannel: 'category1_five',
                },
            },
        });

        store.dispatch(Actions.multiSelectChannelTo('category1_one'));

        expect(store.getState().views.channelSidebar.multiSelectedChannelIds).toEqual(['category1_one', 'category1_two', 'category1_three', 'category1_four', 'category1_five']);
    });

    test('should select group of channels across categories', () => {
        const store = configureStore({
            ...initialState,
            views: {
                channelSidebar: {
                    multiSelectedChannelIds: ['category1_five'],
                    lastSelectedChannel: 'category1_five',
                },
            },
        });

        store.dispatch(Actions.multiSelectChannelTo('category2_two'));

        expect(store.getState().views.channelSidebar.multiSelectedChannelIds).toEqual(['category1_five', 'category1_six', 'category1_seven', 'category2_one', 'category2_two']);
    });
});

describe('moveChannelsInSidebar', () => {
    const makeState = (): DeepPartial<GlobalState> => ({
        entities: {
            users: {
                currentUserId: 'user',
                profiles: {
                    agent: {id: 'agent', is_bot: true, is_agent: true},
                    teammate: {id: 'teammate'},
                },
            },
            channelCategories: {
                byId: {
                    favorites: {id: 'favorites', team_id: 'team1', type: 'favorites' as const, channel_ids: ['agentDm'], sorting: CategorySorting.Manual},
                    agents: {id: 'agents', team_id: 'team1', type: 'agents' as const, channel_ids: [], sorting: CategorySorting.Recency},
                    dms: {id: 'dms', team_id: 'team1', type: 'direct_messages' as const, channel_ids: ['teammateDm'], sorting: CategorySorting.Recency},
                    channels: {id: 'channels', team_id: 'team1', type: 'channels' as const, channel_ids: ['publicChannel'], sorting: CategorySorting.Alphabetical},
                },
                orderByTeam: {
                    team1: ['favorites', 'agents', 'dms', 'channels'],
                },
            },
            channels: {
                currentChannelId: 'publicChannel',
                channels: {
                    agentDm: {id: 'agentDm', type: 'D' as const, name: 'user__agent', delete_at: 0},
                    teammateDm: {id: 'teammateDm', type: 'D' as const, name: 'user__teammate', delete_at: 0},
                    publicChannel: {id: 'publicChannel', type: 'O' as const, name: 'public', delete_at: 0},
                },
                myMembers: {
                    agentDm: {channel_id: 'agentDm', user_id: 'user'},
                    teammateDm: {channel_id: 'teammateDm', user_id: 'user'},
                    publicChannel: {channel_id: 'publicChannel', user_id: 'user'},
                },
                channelsInTeam: {
                    team1: new Set(['agentDm', 'teammateDm', 'publicChannel']),
                },
            },
            preferences: {
                myPreferences: {
                    'direct_channel_show--agent': {category: 'direct_channel_show', name: 'agent', value: 'true'},
                    'direct_channel_show--teammate': {category: 'direct_channel_show', name: 'teammate', value: 'true'},
                },
            },
            teams: {
                currentTeamId: 'team1',
            },
        },
        views: {
            channelSidebar: {
                multiSelectedChannelIds: ['agentDm', 'teammateDm', 'publicChannel'],
                lastSelectedChannel: '',
            },
        },
    });

    function movedChannelIds(targetCategoryId: string) {
        const store = configureStore(makeState());

        // The categories are updated optimistically before the server is called
        store.dispatch(Actions.moveChannelsInSidebar(targetCategoryId, 0, 'agentDm'));

        return store.getState().entities.channelCategories.byId[targetCategoryId].channel_ids;
    }

    test('should only move agent DMs into the Agents category', () => {
        expect(movedChannelIds('agents')).toEqual(['agentDm']);
    });

    test('should not move agent DMs into the Direct Messages category', () => {
        expect(movedChannelIds('dms')).toEqual(['teammateDm']);
    });

    test('should not move agent DMs into the Channels category', () => {
        expect(movedChannelIds('channels')).toEqual(['publicChannel']);
    });

    test('should move any channel into Favorites', () => {
        expect(movedChannelIds('favorites')).toEqual(['agentDm', 'teammateDm', 'publicChannel']);
    });
});
