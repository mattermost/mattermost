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
 *
 * Matcher cost: the resolver iterates every registered matcher on every call. The
 * framework does not memoize across dispatches because the matcher contract takes
 * full Redux state and we cannot know what slices it reads. Plugins with expensive
 * matchers should memoize internally using `createSelector` keyed on the slices
 * the matcher actually consults.
 */
export function useChannelIconOverrideName(channel?: Channel): IconGlyphTypes | null {
    return useSelector((state: GlobalState) => getChannelIconOverrideForChannel(state, channel));
}
