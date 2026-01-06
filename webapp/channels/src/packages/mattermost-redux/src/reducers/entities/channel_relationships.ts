// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {ChannelRelationship, ChannelRelationshipsState} from '@mattermost/types/channel_relationships';
import type {Channel} from '@mattermost/types/channels';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import type {MMReduxAction} from 'mattermost-redux/action_types';
import {ChannelRelationshipTypes, UserTypes, ChannelTypes} from 'mattermost-redux/action_types';

const toNewObj = <T extends {id: string}>(current: IDMappedObjects<T>, arr: T[]) => {
    return arr.reduce((acc, x) => {
        return {...acc, [x.id]: x};
    }, {...current});
};

export function byChannelId(state: ChannelRelationshipsState['byChannelId'] = {}, action: MMReduxAction) {
    switch (action.type) {
    case ChannelRelationshipTypes.FETCH_CHANNEL_RELATIONSHIPS_SUCCESS: {
        const channelId: Channel['id'] = action.data.channelId;
        const relationships: ChannelRelationship[] = action.data.relationships;

        return {
            ...state,
            [channelId]: toNewObj(state[channelId] || {}, relationships),
        };
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
