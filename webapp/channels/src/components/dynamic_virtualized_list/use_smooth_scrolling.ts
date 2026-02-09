// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';

import type {GlobalState} from 'types/store';

/**
 * Hook that checks if smooth scrolling is enabled via feature flag + user preference.
 *
 * Returns true when both:
 * - Admin has enabled FeatureFlagSmoothScrolling
 * - User hasn't disabled their smooth_scrolling preference (default: enabled)
 */
export function useSmoothScrollingEnabled(): boolean {
    const config = useSelector(getConfig);
    const smoothScrollPref = useSelector((state: GlobalState) =>
        getPreference(state, 'display_settings', 'smooth_scrolling', 'true'),
    );

    const featureEnabled = config?.FeatureFlagSmoothScrolling === 'true';
    const userEnabled = smoothScrollPref !== 'false';

    return featureEnabled && userEnabled;
}
