// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    Channel,
    ChannelMessageCount,
    ServerChannel,
} from '@mattermost/types/channels';
import {RelationOneToOne} from '@mattermost/types/utilities';

import {
    AdminTypes,
    ChannelTypes,
    UserTypes,
    SchemeTypes,
} from 'mattermost-redux/action_types';
import {General} from 'mattermost-redux/constants';
import {GenericAction} from 'mattermost-redux/types/actions';

export default function messageCounts(state: RelationOneToOne<Channel, ChannelMessageCount> = {}, action: GenericAction): RelationOneToOne<Channel, ChannelMessageCount> {
    switch (action.type) {
    case ChannelTypes.RECEIVED_CHANNEL: {
        const channel: ServerChannel = action.data;

        return updateMessageCount(state, channel);
    }
    case AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS: {
        const channels: ServerChannel[] = action.data.channels;

        return channels.reduce(updateMessageCount, state);
    }
    case AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SEARCH:
    case ChannelTypes.RECEIVED_CHANNELS:
    case ChannelTypes.RECEIVED_ALL_CHANNELS:
    case SchemeTypes.RECEIVED_SCHEME_CHANNELS: {
        const channels: ServerChannel[] = action.data;

        return channels.reduce(updateMessageCount, state);
    }

    case ChannelTypes.LEAVE_CHANNEL: {
        const channel: ServerChannel | undefined = action.data;

        if (!channel || channel.type !== General.OPEN_CHANNEL) {
            return state;
        }

        const nextState = {...state};
        Reflect.deleteProperty(nextState, channel.id);
        return nextState;
    }

    case ChannelTypes.INCREMENT_TOTAL_MSG_COUNT: {
        const channelId: string = action.data.channelId;
        const amount: number = action.data.amount;
        const amountRoot: number = action.data.amountRoot;

        const existing = state[channelId];

        if (!existing) {
            return state;
        }

        return {
            ...state,
            [channelId]: {
                root: existing.root + amountRoot,
                total: existing.total + amount,
            },
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export function updateMessageCount(state: RelationOneToOne<Channel, ChannelMessageCount>, channel: ServerChannel) {
    const existing = state[channel.id];
    if (
        existing &&
        existing.root === channel.total_msg_count_root &&
        existing.total === channel.total_msg_count
    ) {
        return state;
    }

    return {
        ...state,
        [channel.id]: {
            root: channel.total_msg_count_root,
            total: channel.total_msg_count,
        },
    };
}
