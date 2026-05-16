// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';

import {Preferences} from 'mattermost-redux/constants';
import {getMyPreferences, getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {applyTheme} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {ThemeContext} from './theme_context';

function osIsDarkNow(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function ThemeProvider({children}: {children: React.ReactNode}) {
    // Counter: 0 = unthemed login screens, ≥1 = full app (use user theme).
    const [usingUserTheme, setUsingUserTheme] = useState(0);

    // Track OS dark-mode state reactively.
    const [osDark, setOsDark] = useState(osIsDarkNow);

    // Whether the user opted in to OS sync.
    const syncWithOS = useSelector((state: GlobalState) => {
        const key = getPreferenceKey(
            Preferences.CATEGORY_DISPLAY_SETTINGS,
            Preferences.NAME_THEME_SYNC_WITH_OS,
        );
        return getMyPreferences(state)[key]?.value === 'true';
    });

    // The theme saved by the user in their preferences.
    const savedTheme = useSelector((state: GlobalState) => {
        if (usingUserTheme > 0) {
            return getTheme(state);
        }
        return Preferences.THEMES.denim;
    });

    // Subscribe to OS dark-mode changes for the entire session lifetime.
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = (e: MediaQueryListEvent) => setOsDark(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // The effective theme: OS-driven when sync is on, saved otherwise.
    const theme = useMemo(() => {
        if (syncWithOS && usingUserTheme > 0) {
            return osDark ? Preferences.THEMES.onyx : Preferences.THEMES.denim;
        }
        return savedTheme;
    }, [syncWithOS, osDark, savedTheme, usingUserTheme]);

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
