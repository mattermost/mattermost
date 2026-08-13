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
 * Clearing sends an explicit null and dispatches the delete action, because the
 * server answers a user-initiated clear with an upserted null-valued row rather
 * than a delete event — story 1 pinned that shape. Without the local dispatch
 * the cleared value would linger until a refetch.
 *
 * Mirrors the write the Channel Settings classification control already
 * performs, so both surfaces produce the same events.
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
