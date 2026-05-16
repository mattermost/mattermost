// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';

import {Preferences} from 'mattermost-redux/constants';
import {getMyPreferences, getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {applyTheme} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {ThemeContext} from './theme_context';

function osIsDarkNow(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function ThemeProvider({children}: {children: React.ReactNode}) {
    // Counter: kept for API compatibility with WithUserTheme / useUserTheme consumers.
    const [usingUserTheme, setUsingUserTheme] = useState(0);

    // Track OS dark-mode state reactively.
    const [osDark, setOsDark] = useState(osIsDarkNow);

    // User is considered "active" when logged in — used to suppress theme sync
    // on the login / pre-auth screens instead of relying on the fragile counter.
    const isLoggedIn = useSelector((state: GlobalState) => Boolean(getCurrentUserId(state)));

    // Whether the user opted in to OS sync.
    const syncWithOS = useSelector((state: GlobalState) => {
        const key = getPreferenceKey(
            Preferences.CATEGORY_DISPLAY_SETTINGS,
            Preferences.NAME_THEME_SYNC_WITH_OS,
        );
        return getMyPreferences(state)[key]?.value === 'true';
    });

    // The theme saved by the user in their preferences (only meaningful when logged in).
    const savedTheme = useSelector((state: GlobalState) => {
        if (isLoggedIn) {
            return getTheme(state);
        }
        return Preferences.THEMES.quartz;
    });

    // Subscribe to OS dark-mode changes for the entire session lifetime.
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setOsDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // The effective theme: OS-driven when logged in + sync enabled, saved otherwise.
    // usingUserTheme counter is intentionally NOT used here — relying on it caused
    // sync to break when navigating to routes not wrapped by WithUserTheme (Playbooks,
    // System Console, select_team, etc.).
    const theme = useMemo(() => {
        if (syncWithOS && isLoggedIn) {
            return osDark ? Preferences.THEMES.onyx : Preferences.THEMES.quartz;
        }
        return savedTheme;
    }, [syncWithOS, osDark, savedTheme, isLoggedIn]);

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const context = useMemo(() => ({
        startUsingUserTheme: () => setUsingUserTheme((count) => count + 1),
        stopUsingUserTheme: () => setUsingUserTheme((count) => count - 1),
    }), []);

    return (
        <ThemeContext.Provider value={context}>
            {children}
        </ThemeContext.Provider>
    );
}
