// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChannelRelationshipsState} from '@mattermost/types/channel_relationships';
import type {GlobalState} from '@mattermost/types/store';

const EMPTY_RELATIONSHIPS = {};

export const getChannelRelationships = (state: GlobalState, channelId: string): ChannelRelationshipsState['byChannelId'][string] => {
    const relationships = state.entities.channelRelationships.byChannelId[channelId];

    if (!relationships) {
        return EMPTY_RELATIONSHIPS;
    }

    return relationships;
};

export const getChannelRelationship = (state: GlobalState, channelId: string, relationshipId: string) => {
    return getChannelRelationships(state, channelId)[relationshipId];
};
