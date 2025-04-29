// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

export function getRemoteNamesForChannel(state: GlobalState, channelId: string): string[] {
    return state.entities?.sharedChannels?.remoteNames?.[channelId] || [];
}
