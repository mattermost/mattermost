// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import type {GlobalState} from 'types/store';

/**
 * Test state in which a plugin has registered the given channels as boards, so components show
 * their board wording for them. Merge it into the initial state passed to renderWithContext.
 */
export function boardChannelsState(...channelIds: string[]): DeepPartial<GlobalState> {
    return {
        plugins: {
            components: {
                ChannelKind: [{
                    id: 'board-kind',
                    pluginId: 'boards',
                    kind: 'board',
                    matcher: (_state: GlobalState, channel: {id: string}) => channelIds.includes(channel.id),
                }],
            },
        },
    } as DeepPartial<GlobalState>;
}
