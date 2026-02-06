// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

const Preferences = Constants.Preferences;
const MOBILE_BREAKPOINT = 768;

/**
 * Hook to determine if Guilded layout is active.
 * Returns true only if:
 * 1. GuildedChatLayout feature flag is enabled
 * 2. User preference for guilded_chat_layout is true (default: true)
 * 3. Viewport width is >= 768px (desktop)
 */
export function useGuildedLayout(): boolean {
    const config = useSelector(getConfig);
    const isFeatureEnabled = config.FeatureFlagGuildedChatLayout === 'true';
    const userPrefEnabled = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.GUILDED_CHAT_LAYOUT, true));

    const [isDesktop, setIsDesktop] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }
        return window.innerWidth >= MOBILE_BREAKPOINT;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleResize = () => {
            setIsDesktop(window.innerWidth >= MOBILE_BREAKPOINT);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isFeatureEnabled && userPrefEnabled && isDesktop;
}

/**
 * Hook to get just the feature flag + user preference state (ignoring viewport).
 * Useful for checking if the feature is configured and user hasn't opted out, even on mobile.
 */
export function useGuildedLayoutEnabled(): boolean {
    const config = useSelector(getConfig);
    const isFeatureEnabled = config.FeatureFlagGuildedChatLayout === 'true';
    const userPrefEnabled = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.GUILDED_CHAT_LAYOUT, true));
    return isFeatureEnabled && userPrefEnabled;
}
