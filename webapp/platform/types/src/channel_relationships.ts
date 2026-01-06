// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from './channels';
import type {IDMappedObjects} from './utilities';

export type ChannelRelationshipType = 'bookmark' | 'mention' | 'link';

export type ChannelRelationship = {
    id: string;
    source_channel_id: string;
    target_channel_id: string;
    relationship_type: ChannelRelationshipType;
    created_at: number;
    metadata?: Record<string, unknown>;
};

export type ChannelRelationshipWithChannel = ChannelRelationship & {
    channel?: Channel;
};

export type GetRelatedChannelsResponse = {
    relationships: ChannelRelationshipWithChannel[];
    total_count: number;
};

export type ChannelRelationshipsState = {
    byChannelId: {
        [channelId: Channel['id']]: IDMappedObjects<ChannelRelationship>;
    };
};
