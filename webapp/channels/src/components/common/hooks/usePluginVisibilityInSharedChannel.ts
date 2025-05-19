// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

/**
 * Custom hook to determine if plugin components should be visible in a shared channel.
 *
 * @param isSharedChannel - Whether the current channel is a shared channel
 * @returns true if plugins should be visible, false otherwise
 *
 * Plugins are visible when:
 * - The channel is not shared, OR
 * - The channel is shared AND the EnableSharedChannelsPlugins feature flag is enabled
 */
export function usePluginVisibilityInSharedChannel(isSharedChannel: boolean): boolean {
    const sharedChannelsPluginsEnabled = useSelector((state: GlobalState) =>
        getFeatureFlagValue(state, 'EnableSharedChannelsPlugins') === 'true',
    );

    return !isSharedChannel || sharedChannelsPluginsEnabled;
}
