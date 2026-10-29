// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getChannelKind} from 'utils/channel_kind';

import type {GlobalState} from 'types/store';
import type {ChannelKind} from 'types/store/plugins';

/**
 * The kind of the channel ('board' when a plugin registered it with registerChannelKind,
 * otherwise 'channel'), which picks the component's message from a KindMessages entry:
 * "Board Settings" rather than "Channel Settings", and so on.
 */
export function useChannelKind(channel?: Pick<Channel, 'id'> | null): ChannelKind {
    return useSelector((state: GlobalState) => getChannelKind(state, channel));
}
