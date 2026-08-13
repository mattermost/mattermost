// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';

import {Preferences} from 'mattermost-redux/constants';
import {get, getBool, getTheme} from 'mattermost-redux/selectors/entities/preferences';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {setThemeDefaults} from 'mattermost-redux/utils/theme_utils';

import {applyTheme} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {ThemeContext} from './theme_context';

const CATEGORY_THEME_DARK = 'theme_dark';

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
        if (mql.addEventListener) {
            mql.addEventListener('change', handler);
            return () => mql.removeEventListener('change', handler);
        } else if (mql.addListener) {
            // Fallback for older browsers (Safari <14)
            mql.addListener(handler);
            return () => mql.removeListener(handler);
        }
        return undefined;
    }, []);

    return isDark;
}

export default function ThemeProvider({children}: {children: React.ReactNode}) {
    // This keeps track of if we're in a themed part of the app. Realistically, it should only ever be 0 (unthemed) or
    // 1 (themed), but using a counter lets us handle cases where the start/stop functions are called multiple times or
    // in the wrong order.
    const [usingUserTheme, setUsingUserTheme] = useState(0);
    const systemDarkMode = useSystemDarkMode();

    const teamId = useSelector((state: GlobalState) => state.entities.teams.currentTeamId);
    const autoSwitchEnabled = useSelector((state: GlobalState) => getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, 'theme_auto_switch'));
    const teamDarkThemeRaw = useSelector((state: GlobalState) => get(state, CATEGORY_THEME_DARK, teamId));
    const defaultDarkThemeRaw = useSelector((state: GlobalState) => get(state, CATEGORY_THEME_DARK, ''));
    const reduxTheme = useSelector(getTheme);

    const theme = useMemo(() => {
        if (usingUserTheme <= 0) {
            return Preferences.THEMES.denim;
        }

        if (systemDarkMode && autoSwitchEnabled) {
            const rawValue = teamDarkThemeRaw || defaultDarkThemeRaw;

            if (rawValue) {
                try {
                    const parsed: Theme = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
                    return setThemeDefaults(parsed);
                } catch {
                    // Fall through to reduxTheme if parsing fails
                }
            }
        }

        return reduxTheme;
    }, [usingUserTheme, systemDarkMode, autoSwitchEnabled, teamDarkThemeRaw, defaultDarkThemeRaw, reduxTheme]);

    useEffect(() => {
        if (theme) {
            applyTheme(theme);
        }
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
