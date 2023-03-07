// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getRandomId} from '@e2e-support/util';
import {Channel, ChannelType} from '@mattermost/types/channels';

export function createRandomChannel(
    teamId: string,
    name: string,
    displayName: string,
    type: ChannelType = 'O',
    purpose = '',
    header = '',
    unique = true
): Channel {
    const randomSuffix = getRandomId();

    const channel = {
        team_id: teamId,
        name: unique ? `${name}-${randomSuffix}` : name,
        display_name: unique ? `${displayName} ${randomSuffix}` : displayName,
        type,
        purpose,
        header,
    };

    return channel as Channel;
}
