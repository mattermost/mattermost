// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelCategoryTypes, ChannelTypes, TeamTypes} from 'mattermost-redux/action_types';
import {CategoryTypes} from 'mattermost-redux/constants/channel_categories';

import * as Reducers from './channel_categories';

describe('byId', () => {
    test('should remove references to a channel when leaving it', () => {
        const initialState = {
            category1: {id: 'category1', channel_ids: ['channel1', 'channel2']},
            category2: {id: 'category2', channel_ids: ['channel3', 'channel4']},
        };

        const state = Reducers.byId(
            initialState,
            {
                type: ChannelTypes.LEAVE_CHANNEL,
                data: {
                    id: 'channel3',
                },
            },
        );

        expect(state.category1).toBe(initialState.category1);
        expect(state.category2.channel_ids).toEqual(['channel4']);
    });

    test('should remove corresponding categories when leaving a team', () => {
        const initialState = {
            category1: {id: 'category1', team_id: 'team1', type: CategoryTypes.CUSTOM},
            category2: {id: 'category2', team_id: 'team1', type: CategoryTypes.CUSTOM},
            dmCategory1: {id: 'dmCategory1', team_id: 'team1', type: CategoryTypes.DIRECT_MESSAGES},
            category3: {id: 'category3', team_id: 'team2', type: CategoryTypes.CUSTOM},
            category4: {id: 'category4', team_id: 'team2', type: CategoryTypes.CUSTOM},
            dmCategory2: {id: 'dmCategory1', team_id: 'team2', type: CategoryTypes.DIRECT_MESSAGES},
        };

        const state = Reducers.byId(
            initialState,
            {
                type: TeamTypes.LEAVE_TEAM,
                data: {
                    id: 'team1',
                },
            },
        );

        expect(state).toEqual({
            category3: state.category3,
            category4: state.category4,
            dmCategory2: state.dmCategory2,
        });
    });
});

describe('orderByTeam', () => {
    test('should remove correspoding order when leaving a team', () => {
        const initialState = {
            team1: ['category1', 'category2', 'dmCategory1'],
            team2: ['category3', 'category4', 'dmCategory2'],
        };

        const state = Reducers.orderByTeam(
            initialState,
            {
                type: TeamTypes.LEAVE_TEAM,
                data: {
                    id: 'team1',
                },
            },
        );

        expect(state).toEqual({
            team2: initialState.team2,
        });
    });
});

describe('managedCategoryMappings', () => {
    test('should replace mappings for a team when received again', () => {
        const initialState = {
            team1: {channel1: 'Old Category'},
            team2: {channel3: 'Other'},
        };

        const state = Reducers.managedCategoryMappings(
            initialState,
            {
                type: ChannelCategoryTypes.RECEIVED_MANAGED_CATEGORY_MAPPINGS,
                data: {
                    team_id: 'team1',
                    mappings: {channel1: 'New Category', channel2: 'New Category'},
                },
            },
        );

        expect(state.team1).toEqual({channel1: 'New Category', channel2: 'New Category'});
        expect(state.team2).toBe(initialState.team2);
    });

    test('should add a single channel mapping when set', () => {
        const initialState = {
            team1: {channel1: 'Operations'},
        };

        const state = Reducers.managedCategoryMappings(
            initialState,
            {
                type: ChannelCategoryTypes.MANAGED_CATEGORY_MAPPING_SET,
                data: {
                    team_id: 'team1',
                    id: 'channel2',
                    category_name: 'Support',
                },
            },
        );

        expect(state.team1).toEqual({channel1: 'Operations', channel2: 'Support'});
    });

    test('should update an existing channel mapping when set', () => {
        const initialState = {
            team1: {channel1: 'Operations'},
        };

        const state = Reducers.managedCategoryMappings(
            initialState,
            {
                type: ChannelCategoryTypes.MANAGED_CATEGORY_MAPPING_SET,
                data: {
                    team_id: 'team1',
                    id: 'channel1',
                    category_name: 'Support',
                },
            },
        );

        expect(state.team1).toEqual({channel1: 'Support'});
    });

    test('should remove a channel mapping when removed', () => {
        const initialState = {
            team1: {channel1: 'Operations', channel2: 'Support'},
        };

        const state = Reducers.managedCategoryMappings(
            initialState,
            {
                type: ChannelCategoryTypes.MANAGED_CATEGORY_MAPPING_REMOVED,
                data: {
                    team_id: 'team1',
                    id: 'channel1',
                },
            },
        );

        expect(state.team1).toEqual({channel2: 'Support'});
    });

    test('should remove a channel mapping when leaving the channel', () => {
        const initialState = {
            team1: {channel1: 'Operations', channel2: 'Support'},
        };

        const state = Reducers.managedCategoryMappings(
            initialState,
            {
                type: ChannelTypes.LEAVE_CHANNEL,
                data: {
                    id: 'channel1',
                    team_id: 'team1',
                },
            },
        );

        expect(state.team1).toEqual({channel2: 'Support'});
    });

    test('should not change state when leaving a channel without team_id', () => {
        const initialState = {
            team1: {channel1: 'Operations'},
        };

        const state = Reducers.managedCategoryMappings(
            initialState,
            {
                type: ChannelTypes.LEAVE_CHANNEL,
                data: {
                    id: 'channel1',
                },
            },
        );

        expect(state).toBe(initialState);
    });

    test('should remove all mappings for a team when leaving it', () => {
        const initialState = {
            team1: {channel1: 'Operations'},
            team2: {channel2: 'Support'},
        };

        const state = Reducers.managedCategoryMappings(
            initialState,
            {
                type: TeamTypes.LEAVE_TEAM,
                data: {
                    id: 'team1',
                },
            },
        );

        expect(state).toEqual({team2: {channel2: 'Support'}});
        expect(state.team1).toBeUndefined();
    });

    test('should not change state when leaving a team with no mappings', () => {
        const initialState = {
            team1: {channel1: 'Operations'},
        };

        const state = Reducers.managedCategoryMappings(
            initialState,
            {
                type: TeamTypes.LEAVE_TEAM,
                data: {
                    id: 'team2',
                },
            },
        );

        expect(state).toBe(initialState);
    });
});
