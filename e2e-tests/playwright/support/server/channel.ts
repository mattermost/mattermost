// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '@e2e-support/util';
import {Channel, ChannelType} from '@mattermost/types/channels';

type ChannelInput = {
    teamId: string;
    name: string;
    displayName: string;
    type?: ChannelType;
    purpose?: string;
    header?: string;
    unique?: boolean;
};

export function createRandomChannel(channelInput: ChannelInput): Channel {
    const channel = {
        team_id: channelInput.teamId,
        name: channelInput.name,
        display_name: channelInput.displayName,
        type: channelInput.type || 'O',
        purpose: channelInput.type || '',
        header: channelInput.type || '',
    };

    if (channelInput.unique) {
        const randomSuffix = getRandomId();

        channel.name = `${channelInput.name}-${randomSuffix}`;
        channel.display_name = `${channelInput.displayName} ${randomSuffix}`;
    }

    return channel as Channel;
}
