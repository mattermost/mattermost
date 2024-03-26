// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {ChannelCategory} from '@mattermost/types/channel_categories';
import type {Channel} from '@mattermost/types/channels';
import type {Team} from '@mattermost/types/teams';
import type {IDMappedObjects, RelationOneToOne} from '@mattermost/types/utilities';

import {ChannelCategoryTypes, TeamTypes, UserTypes, ChannelTypes} from 'mattermost-redux/action_types';
import {removeItem} from 'mattermost-redux/utils/array_utils';

export function byId(state: IDMappedObjects<ChannelCategory> = {}, action: AnyAction) {
    switch (action.type) {
    case ChannelCategoryTypes.RECEIVED_CATEGORIES: {
        const categories: ChannelCategory[] = action.data;

        return categories.reduce((nextState, category) => {
            return {
                ...nextState,
                [category.id]: {
                    ...nextState[category.id],
                    ...category,
                    collapsed: action.isWebSocket ? state[category.id].collapsed : category.collapsed,
                },
            };
        }, state);
    }
    case ChannelCategoryTypes.RECEIVED_CATEGORY: {
        const category: ChannelCategory = action.data;

        return {
            ...state,
            [category.id]: {
                ...state[category.id],
                ...category,
            },
        };
    }

    case ChannelCategoryTypes.CATEGORY_DELETED: {
        const categoryId: ChannelCategory['id'] = action.data;

        const nextState = {...state};

        Reflect.deleteProperty(nextState, categoryId);

        return nextState;
    }

    case ChannelTypes.LEAVE_CHANNEL: {
        const channelId: string = action.data.id;

        const nextState = {...state};
        let changed = false;

        for (const category of Object.values(state)) {
            const index = category.channel_ids.indexOf(channelId);

            if (index === -1) {
                continue;
            }

            const nextChannelIds = [...category.channel_ids];
            nextChannelIds.splice(index, 1);

            nextState[category.id] = {
                ...category,
                channel_ids: nextChannelIds,
            };

            changed = true;
        }

        return changed ? nextState : state;
    }
    case TeamTypes.LEAVE_TEAM: {
        const team: Team = action.data;

        const nextState = {...state};
        let changed = false;

        for (const category of Object.values(state)) {
            if (category.team_id !== team.id) {
                continue;
            }

            Reflect.deleteProperty(nextState, category.id);
            changed = true;
        }

        return changed ? nextState : state;
    }
    case ChannelTypes.GM_CONVERTED_TO_CHANNEL: {
        // For GM to Private channel conversion feature
        // In the case when someone converts your GM to a private channel and moves it to a team
        // you're not currently on, we need to remove the channel from "direct messages" category
        // and add it to "channels" category of target team. Even though the server sends a websocket event about updated category data,
        // it does so only for the team the channel got moved into, and not every team a user is part of, for performance reasons.
        // For every other team, we update the state here. Everything is correct on server side, but we update state here
        // to avoid re-fetching all categories again for all teams.

        const receivedChannel = action.data as Channel;
        const newState: IDMappedObjects<ChannelCategory> = {};
        const categoryIDs = Object.keys(state);

        categoryIDs.forEach((categoryID) => {
            if (categoryID.startsWith('channels_') && state[categoryID].team_id === receivedChannel.team_id && state[categoryID].channel_ids.indexOf(receivedChannel.id) < 0) {
                // We don't need to worry about adding the channel in the right order as this is only
                // an intermediate step, meant to handle the edge case of missing the upcoming "update category"
                // websocket message, triggered on conversion of GM to private channel.
                newState[categoryID] = {
                    ...state[categoryID],
                    channel_ids: [...state[categoryID].channel_ids, receivedChannel.id],
                };
            } else {
                newState[categoryID] = {
                    ...state[categoryID],
                    channel_ids: state[categoryID].channel_ids.filter((channelID) => channelID !== receivedChannel.id),
                };
            }
        });

        return newState;
    }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function orderByTeam(state: RelationOneToOne<Team, Array<ChannelCategory['id']>> = {}, action: AnyAction) {
    switch (action.type) {
    case ChannelCategoryTypes.RECEIVED_CATEGORY_ORDER: {
        const teamId: string = action.data.teamId;
        const order: string[] = action.data.order;

        return {
            ...state,
            [teamId]: order,
        };
    }

    case ChannelCategoryTypes.CATEGORY_DELETED: {
        const categoryId: ChannelCategory['id'] = action.data;

        const nextState = {...state};

        for (const teamId of Object.keys(nextState)) {
            // removeItem only modifies the array if it contains the category ID, so other teams' state won't be modified
            nextState[teamId] = removeItem(state[teamId], categoryId);
        }

        return nextState;
    }

    case TeamTypes.LEAVE_TEAM: {
        const team: Team = action.data;

        if (!state[team.id]) {
            return state;
        }

        const nextState = {...state};
        Reflect.deleteProperty(nextState, team.id);

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    byId,
    orderByTeam,
});
