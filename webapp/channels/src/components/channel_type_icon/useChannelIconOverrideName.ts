// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';

import {getChannelIconOverrideForChannel} from './channel_icon_override';

export function useChannelIconOverrideName(channel?: Channel): IconGlyphTypes | null {
    return useSelector((state: GlobalState) => getChannelIconOverrideForChannel(state, channel));
}
