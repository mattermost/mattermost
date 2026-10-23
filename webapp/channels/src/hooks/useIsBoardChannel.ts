// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {isBoardChannel} from 'utils/channel_kind';

import type {GlobalState} from 'types/store';

/**
 * Whether the channel is a board (a plugin registered it with registerChannelKind), so the
 * component shows its board wording: "Board Settings" rather than "Channel Settings", and so on.
 * Each such string is its own message, with its own id, beside the channel one.
 */
export function useIsBoardChannel(channel?: Pick<Channel, 'id'> | null): boolean {
    return useSelector((state: GlobalState) => isBoardChannel(state, channel));
}
