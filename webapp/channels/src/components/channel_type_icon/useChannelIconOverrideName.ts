// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';

import {getChannelIconOverrideForChannel} from './channel_icon_override';

/**
 * Returns the override icon name (e.g., `'shield-outline'`) for the given channel
 * from the first matching plugin registration, or null if no override matches.
 *
 * For font-icon sites, prefer the `<ChannelTypeIcon channel={channel}/>` component,
 * which handles override resolution and rendering. Use this hook only when you
 * need the raw icon name for an SVG render path (resolve via
 * `compassIconForName(name)` and render the resulting component).
 */
export function useChannelIconOverrideName(channel?: Channel | null): IconGlyphTypes | null {
    return useSelector((state: GlobalState) => getChannelIconOverrideForChannel(state, channel));
}
