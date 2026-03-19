// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {ChannelTab, ChannelTabsState} from '@mattermost/types/channel_tabs';
import type {Channel} from '@mattermost/types/channels';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {ChannelTabTypes, UserTypes, ChannelTypes} from 'mattermost-redux/action_types';

const toNewObj = <T extends {id: string}>(current: IDMappedObjects<T>, arr: T[]) => {
    return arr.reduce((acc, x) => {
        return {...acc, [x.id]: x};
    }, {...current});
};

export function byChannelId(state: ChannelTabsState['byChannelId'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelTabTypes.RECEIVED_TABS: {
        const channelId: Channel['id'] = action.data.channelId;
        const tabs: ChannelTab[] = action.data.tabs;

        return {
            ...state,
            [channelId]: toNewObj(state[channelId], tabs),
        };
    }

    case ChannelTabTypes.RECEIVED_TAB: {
        const tab: ChannelTab = action.data;
        const {id, channel_id: channelId} = tab;

        return {
            ...state,
            [channelId]: {
                ...state[channelId],
                [id]: tab,
            },
        };
    }

    case ChannelTabTypes.TAB_DELETED: {
        const tab: ChannelTab = action.data;

        const channelNextState = {...state[tab.channel_id]};

        Reflect.deleteProperty(channelNextState, tab.id);

        const nextState = {...state, [tab.channel_id]: channelNextState};

        return nextState;
    }

    case ChannelTypes.LEAVE_CHANNEL: {
        const channelId: string = action.data.channelId;

        const nextState = {...state};

        Reflect.deleteProperty(nextState, channelId);

        return nextState;
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    byChannelId,
});
