// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {ChannelBookmark, ChannelBookmarksState} from '@mattermost/types/channel_bookmarks';
import type {Channel, ServerChannelWithBookmarks} from '@mattermost/types/channels';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import {ChannelBookmarkTypes, UserTypes, ChannelTypes} from 'mattermost-redux/action_types';
import type {GenericAction} from 'mattermost-redux/types/actions';

const toNewObj = <T extends {id: string}>(current: IDMappedObjects<T>, arr: T[]) => {
    return arr.reduce((acc, x) => {
        return {...acc, [x.id]: x};
    }, {...current});
};

export function byChannelId(state: ChannelBookmarksState['byChannelId'] = {}, action: GenericAction) {
    switch (action.type) {
    case ChannelBookmarkTypes.RECEIVED_BOOKMARKS: {
        const channelId: Channel['id'] = action.data.channelId;
        const bookmarks: ChannelBookmark[] = action.data.bookmarks;

        return {
            ...state,
            [channelId]: toNewObj(state[channelId], bookmarks),
        };
    }

    case ChannelBookmarkTypes.RECEIVED_BOOKMARK: {
        const bookmark: ChannelBookmark = action.data;

        return {
            ...state,
            [bookmark.channel_id]: {
                ...state[bookmark.channel_id],
                [bookmark.id]: {
                    ...state[bookmark.channel_id][bookmark.id],
                },
            },
        };
    }

    case ChannelTypes.RECEIVED_CHANNELS: {
        const channels: ServerChannelWithBookmarks[] = action.data;

        if (!channels) {
            return state;
        }

        return channels.reduce((nextState, channel) => {
            if (!channel.bookmarks) {
                return nextState;
            }

            return {...nextState, [channel.id]: toNewObj(nextState[channel.id], channel.bookmarks)};
        }, {...state});
    }

    case ChannelTypes.RECEIVED_CHANNEL: {
        const channelId: Channel['id'] = action.data.id;
        const bookmarks: ChannelBookmark[] | undefined = action.data.bookmarks;

        if (!bookmarks) {
            return state;
        }

        return {
            ...state,
            [channelId]: toNewObj(state[channelId], bookmarks),
        };
    }

    case ChannelBookmarkTypes.BOOKMARK_DELETED: {
        const channelId: Channel['id'] = action.data.channelId;
        const bookmarkId: ChannelBookmark['id'] = action.data.bookmark.id;

        const channelNextState = state[channelId];

        Reflect.deleteProperty(channelNextState, bookmarkId);

        const nextState = {...state, [channelId]: channelNextState};

        return nextState;
    }

    case ChannelTypes.LEAVE_CHANNEL: {
        const channelId: string = action.data.channelId;

        const nextState = {...state};

        Reflect.deleteProperty(nextState, channelId);

        return nextState;
    }

    // case TeamTypes.LEAVE_TEAM: {
    //     const team: Team = action.data;

    //     const nextState = {...state};
    //     let changed = false;

    //     for (const category of Object.values(state)) {
    //         if (category.team_id !== team.id) {
    //             continue;
    //         }

    //         Reflect.deleteProperty(nextState, category.id);
    //         changed = true;
    //     }

    //     return changed ? nextState : state;
    // }
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    byChannelId,
});
