// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GroupChannel, GroupSyncablesState, GroupTeam, Group} from '@mattermost/types/groups';
import {combineReducers} from 'redux';

import {GroupTypes} from 'mattermost-redux/action_types';
import {GenericAction} from 'mattermost-redux/types/actions';

function syncables(state: Record<string, GroupSyncablesState> = {}, action: GenericAction) {
    switch (action.type) {
    case GroupTypes.RECEIVED_GROUP_TEAMS: {
        return {
            ...state,
            [action.group_id]: {
                ...state[action.group_id],
                teams: action.data,
            },
        };
    }
    case GroupTypes.RECEIVED_GROUP_CHANNELS: {
        return {
            ...state,
            [action.group_id]: {
                ...state[action.group_id],
                channels: action.data,
            },
        };
    }
    case GroupTypes.PATCHED_GROUP_TEAM:
    case GroupTypes.LINKED_GROUP_TEAM: {
        let nextGroupTeams: GroupTeam[] = [];
        if (!state[action.data.group_id] || !state[action.data.group_id].teams || state[action.data.group_id].teams.length === 0) {
            nextGroupTeams = [action.data];
        } else {
            nextGroupTeams = {...state}[action.data.group_id].teams.slice();

            for (let i = 0, len = nextGroupTeams.length; i < len; i++) {
                if (nextGroupTeams[i].team_id === action.data.team_id) {
                    nextGroupTeams[i] = action.data;
                }
            }
        }

        return {
            ...state,
            [action.data.group_id]: {
                ...state[action.data.group_id],
                teams: nextGroupTeams,
            },
        };
    }
    case GroupTypes.PATCHED_GROUP_CHANNEL:
    case GroupTypes.LINKED_GROUP_CHANNEL: {
        let nextGroupChannels: GroupChannel[] = [];

        if (!state[action.data.group_id] || !state[action.data.group_id].channels) {
            nextGroupChannels = [action.data];
        } else {
            nextGroupChannels = {...state}[action.data.group_id].channels.slice();
            for (let i = 0, len = nextGroupChannels.length; i < len; i++) {
                if (nextGroupChannels[i].channel_id === action.data.channel_id) {
                    nextGroupChannels[i] = action.data;
                }
            }
        }

        return {
            ...state,
            [action.data.group_id]: {
                ...state[action.data.group_id],
                channels: nextGroupChannels,
            },
        };
    }
    case GroupTypes.UNLINKED_GROUP_TEAM: {
        if (!state[action.data.group_id]) {
            return state;
        }
        let nextTeams: GroupTeam[] = [];
        let nextChannels: GroupChannel[] = [];
        if (state[action.data.group_id].teams?.length > 0) {
            nextTeams = state[action.data.group_id].teams.slice();

            const index = nextTeams.findIndex((groupTeam) => {
                return groupTeam.team_id === action.data.syncable_id;
            });

            if (index !== -1) {
                nextTeams.splice(index, 1);
            }
        }

        // When we remove a team we also need to remove all channels in that team
        if (state[action.data.group_id].channels?.length > 0) {
            nextChannels = state[action.data.group_id].channels.slice();

            const index = nextChannels.findIndex((groupChannel) => {
                return groupChannel.team_id === action.data.syncable_id;
            });

            if (index !== -1) {
                nextChannels.splice(index, 1);
            }
        }

        return {
            ...state,
            [action.data.group_id]: {
                ...state[action.data.group_id],
                teams: nextTeams,
                channels: nextChannels,
            },
        };
    }
    case GroupTypes.UNLINKED_GROUP_CHANNEL: {
        if (!state[action.data.group_id]) {
            return state;
        }
        const nextChannels = state[action.data.group_id].channels.slice();

        const index = nextChannels.findIndex((groupChannel) => {
            return groupChannel.channel_id === action.data.syncable_id;
        });

        if (index !== -1) {
            nextChannels.splice(index, 1);
        }

        return {
            ...state,
            [action.data.group_id]: {
                ...state[action.data.group_id],
                channels: nextChannels,
            },
        };
    }
    default:
        return state;
    }
}

function myGroups(state: string[] = [], action: GenericAction) {
    switch (action.type) {
    case GroupTypes.ADD_MY_GROUP: {
        const groupId = action.id;
        const nextState = [...state];
        if (state.indexOf(groupId) === -1) {
            nextState.push(groupId);
        }
        return nextState;
    }
    case GroupTypes.RECEIVED_MY_GROUPS: {
        const groups: Group[] = action.data;
        const nextState = [...state];

        groups.forEach((group) => {
            const index = state.indexOf(group.id);

            if (index === -1) {
                nextState.push(group.id);
            }
        });

        return nextState;
    }
    case GroupTypes.REMOVE_MY_GROUP:
    case GroupTypes.ARCHIVED_GROUP: {
        const groupId = action.id;
        const index = state.indexOf(groupId);

        if (index === -1) {
            // There's nothing to remove
            return state;
        }

        // Remove the group ID from my groups list
        const nextState = [...state];
        nextState.splice(index, 1);

        return nextState;
    }
    default:
        return state;
    }
}

function stats(state: any = {}, action: GenericAction) {
    switch (action.type) {
    case GroupTypes.RECEIVED_GROUP_STATS: {
        const stat = action.data;
        return {
            ...state,
            [stat.group_id]: stat,
        };
    }
    default:
        return state;
    }
}

function groups(state: Record<string, Group> = {}, action: GenericAction) {
    switch (action.type) {
    case GroupTypes.CREATE_GROUP_SUCCESS:
    case GroupTypes.PATCHED_GROUP:
    case GroupTypes.RECEIVED_GROUP: {
        return {
            ...state,
            [action.data.id]: action.data,
        };
    }
    case GroupTypes.RECEIVED_MY_GROUPS:
    case GroupTypes.RECEIVED_GROUPS: {
        const nextState = {...state};
        for (const group of action.data) {
            nextState[group.id] = group;
        }
        return nextState;
    }
    case GroupTypes.RECEIVED_ALL_GROUPS_ASSOCIATED_TO_CHANNELS_IN_TEAM: {
        const nextState = {...state};
        const {groupsByChannelId} = action.data;

        for (const channelID of Object.keys(groupsByChannelId)) {
            if (groupsByChannelId[channelID]) {
                for (const group of groupsByChannelId[channelID]) {
                    nextState[group.id] = group;
                }
            }
        }
        return nextState;
    }
    case GroupTypes.RECEIVED_GROUPS_ASSOCIATED_TO_TEAM:
    case GroupTypes.RECEIVED_ALL_GROUPS_ASSOCIATED_TO_TEAM:
    case GroupTypes.RECEIVED_ALL_GROUPS_ASSOCIATED_TO_CHANNEL:
    case GroupTypes.RECEIVED_GROUPS_ASSOCIATED_TO_CHANNEL: {
        const nextState = {...state};
        for (const group of action.data.groups) {
            nextState[group.id] = group;
        }

        return nextState;
    }
    case GroupTypes.ARCHIVED_GROUP: {
        const nextState = {...state};
        Reflect.deleteProperty(nextState, action.id);
        return nextState;
    }
    default:
        return state;
    }
}

export default combineReducers({
    syncables,
    groups,
    stats,
    myGroups,
});
