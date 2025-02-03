// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AnyAction} from 'redux';
import {combineReducers} from 'redux';

import type {RequestStatusType} from '@mattermost/types/requests';

import {ChannelTypes} from 'mattermost-redux/action_types';

import {handleRequest, initialRequestState} from './helpers';

function myChannels(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        ChannelTypes.CHANNELS_REQUEST,
        ChannelTypes.CHANNELS_SUCCESS,
        ChannelTypes.CHANNELS_FAILURE,
        state,
        action,
    );
}

function createChannel(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        ChannelTypes.CREATE_CHANNEL_REQUEST,
        ChannelTypes.CREATE_CHANNEL_SUCCESS,
        ChannelTypes.CREATE_CHANNEL_FAILURE,
        state,
        action,
    );
}

function getChannels(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        ChannelTypes.GET_CHANNELS_REQUEST,
        ChannelTypes.GET_CHANNELS_SUCCESS,
        ChannelTypes.GET_CHANNELS_FAILURE,
        state,
        action,
    );
}

function getAllChannels(state: RequestStatusType = initialRequestState(), action: AnyAction): RequestStatusType {
    return handleRequest(
        ChannelTypes.GET_ALL_CHANNELS_REQUEST,
        ChannelTypes.GET_ALL_CHANNELS_SUCCESS,
        ChannelTypes.GET_ALL_CHANNELS_FAILURE,
        state,
        action,
    );
}

export default combineReducers({
    getChannels,
    getAllChannels,
    myChannels,
    createChannel,
});
