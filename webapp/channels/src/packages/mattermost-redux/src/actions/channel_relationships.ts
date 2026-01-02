// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {ChannelRelationship} from '@mattermost/types/channel_relationships';

import {ChannelRelationshipTypes, ChannelTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

import {logError} from './errors';
import {forceLogoutIfNecessary} from './helpers';

export function fetchChannelRelationships(channelId: string): ActionFuncAsync<ChannelRelationship[]> {
    return async (dispatch, getState) => {
        let relationships: ChannelRelationship[];
        try {
            const response = await Client4.getChannelRelationships(channelId);

            // Extract relationships and channels from response
            relationships = response.relationships.map((rel) => ({
                id: rel.id,
                source_channel_id: rel.source_channel_id,
                target_channel_id: rel.target_channel_id,
                relationship_type: rel.relationship_type,
                created_at: rel.created_at,
                metadata: rel.metadata,
            }));

            // Extract channels and store them
            const channels: Channel[] = response.relationships
                .filter((rel) => rel.channel)
                .map((rel) => rel.channel!);

            if (channels.length > 0) {
                dispatch({
                    type: ChannelTypes.RECEIVED_CHANNELS,
                    data: channels,
                });
            }

            dispatch({
                type: ChannelRelationshipTypes.FETCH_CHANNEL_RELATIONSHIPS_SUCCESS,
                data: {channelId, relationships},
            });
        } catch (error) {
            forceLogoutIfNecessary(error, dispatch, getState);
            dispatch(logError(error));
            return {error};
        }

        return {data: relationships};
    };
}
