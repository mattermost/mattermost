// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

/**
 * Custom hook to determine if plugin components should be visible in a channel.
 *
 * @param channelId - The ID of the channel to check (optional)
 * @returns true if plugins should be visible, false otherwise
 *
 * Plugins are visible when:
 * - The channel ID is undefined/null (defaults to visible), OR
 * - The channel is not shared, OR
 * - The channel is shared AND the EnableSharedChannelsPlugins feature flag is enabled
 */
export function usePluginVisibilityInSharedChannel(channelId: string | undefined): boolean {
    const channel = useSelector((state: GlobalState) =>
        (channelId ? getChannel(state, channelId) : undefined),
    );

    const sharedChannelsPluginsEnabled = useSelector((state: GlobalState) =>
        getFeatureFlagValue(state, 'EnableSharedChannelsPlugins') === 'true',
    );

    // If no channel ID provided or channel not found, default to showing plugins
    if (!channelId || !channel) {
        return true;
    }

    return !channel.shared || sharedChannelsPluginsEnabled;
}
