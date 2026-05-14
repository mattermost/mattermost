// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {getChannelIconClassNameForChannel} from 'selectors/channel_icon_override';

import type {GlobalState} from 'types/store';

export function useChannelIconClassName(channel?: Channel): string {
    return useSelector((state: GlobalState) => getChannelIconClassNameForChannel(state, channel));
}
