// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';

import {Preferences} from 'mattermost-redux/constants';
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {setThemeDefaults} from 'mattermost-redux/utils/theme_utils';

import {applyTheme} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {ThemeContext} from './theme_context';

function useSystemDarkMode(): boolean {
    const [isDark, setIsDark] = useState(() => {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    });

    useEffect(() => {
        const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
        if (!mql) {
            return undefined;
        }

        const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    return isDark;
}

export default function ThemeProvider({children}: {children: React.ReactNode}) {
    // This keeps track of if we're in a themed part of the app. Realistically, it should only ever be 0 (unthemed) or
    // 1 (themed), but using a counter lets us handle cases where the start/stop functions are called multiple times or
    // in the wrong order.
    const [usingUserTheme, setUsingUserTheme] = useState(0);
    const systemDarkMode = useSystemDarkMode();

    const theme = useSelector(useCallback((state: GlobalState) => {
        if (usingUserTheme <= 0) {
            return Preferences.THEMES.denim;
        }

        // Check if auto-switch is enabled and system is in dark mode
        if (systemDarkMode) {
            const prefs = state.entities.preferences.myPreferences;
            const autoSwitchPref = prefs['display_settings--theme_auto_switch'];

            if (autoSwitchPref?.value === 'true') {
                const teamId = state.entities.teams.currentTeamId;
                const teamDarkPref = prefs[`theme_dark--${teamId}`];
                const defaultDarkPref = prefs['theme_dark--'];
                const rawValue = teamDarkPref?.value ?? defaultDarkPref?.value;

                if (rawValue) {
                    try {
                        const parsed: Theme = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
                        return setThemeDefaults(parsed);
                    } catch {
                        // Fall through to getTheme if parsing fails
                    }
                }
            }
        }

        return getTheme(state);
    }, [usingUserTheme, systemDarkMode]));

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
