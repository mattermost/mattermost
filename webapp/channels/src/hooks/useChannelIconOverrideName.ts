// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {Channel} from '@mattermost/types/channels';

import {getChannelIconOverrideForChannel} from 'selectors/channel_icon_override';

import type {GlobalState} from 'types/store';

export function useChannelIconOverrideName(channel?: Channel): IconGlyphTypes | null {
    return useSelector((state: GlobalState) => getChannelIconOverrideForChannel(state, channel));
}
