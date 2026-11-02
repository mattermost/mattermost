// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Dispatch} from 'redux';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE} from 'mattermost-redux/constants/properties';

export type ChannelAttributeValue = string | string[] | null;

/**
 * Writes one attribute value for a channel.
 *
 * Clearing dispatches the delete itself: the server answers a user-initiated clear
 * with an upserted null-valued row, not a delete event, so without this the
 * cleared value lingers until a refetch.
 */
export async function setChannelAttributeValue(
    dispatch: Dispatch,
    channelId: string,
    fieldId: string,
    value: ChannelAttributeValue,
): Promise<void> {
    const isClearing = value === null || value === '' || (Array.isArray(value) && value.length === 0);

    const values = await Client4.patchPropertyValues(
        ACCESS_CONTROL_PROPERTY_GROUP,
        CHANNEL_OBJECT_TYPE,
        channelId,
        [{field_id: fieldId, value: isClearing ? null : value}],
    );

    if (isClearing) {
        dispatch({
            type: PropertyTypes.PROPERTY_VALUE_DELETED,
            data: {targetId: channelId, fieldId},
        });
        return;
    }

    dispatch({
        type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
        data: {values},
    });
}
