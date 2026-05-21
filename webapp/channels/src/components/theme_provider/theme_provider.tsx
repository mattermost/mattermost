// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useLayoutEffect, useMemo, useState} from 'react';
import {useSelector} from 'react-redux';
import {useLocation} from 'react-router-dom';

import {Preferences} from 'mattermost-redux/constants';
import {getMyPreferences, getTheme} from 'mattermost-redux/selectors/entities/preferences';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {applyTheme} from 'utils/utils';
import DesktopApp from 'utils/desktop_api';

import type {GlobalState} from 'types/store';

import {ThemeContext} from './theme_context';

// localStorage keys — persisted so the correct theme can be applied
// synchronously on the next page load before React and Redux initialise.
const LS_SYNC_KEY = 'mm_sync_with_os_theme';
const LS_LIGHT_THEME_KEY = 'mm_light_theme';

function osIsDarkNow(): boolean {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function localSync(): boolean {
    try {
        return localStorage.getItem(LS_SYNC_KEY) === 'true';
    } catch {
        return false;
    }
}

function localLightTheme(): Theme | null {
    try {
        const v = localStorage.getItem(LS_LIGHT_THEME_KEY);
        return v ? JSON.parse(v) as Theme : null;
    } catch {
        return null;
    }
}

// Apply the correct theme at module-load time — before React renders a single
// pixel — so there is no flash of the wrong theme on page load / hard refresh.
// Uses localStorage to know the user's sync preference and their saved light theme.
if (typeof window !== 'undefined' && localSync()) {
    applyTheme(osIsDarkNow() ? Preferences.THEMES.onyx : (localLightTheme() ?? Preferences.THEMES.quartz));
}

export default function ThemeProvider({children}: {children: React.ReactNode}) {
    // Counter: kept for API compatibility with WithUserTheme / useUserTheme consumers.
    const [usingUserTheme, setUsingUserTheme] = useState(0);

    const location = useLocation();
    const isAdminConsole = location.pathname.startsWith('/admin_console');

    // Track OS dark-mode state reactively.
    const [osDark, setOsDark] = useState(osIsDarkNow);

    const isLoggedIn = useSelector((state: GlobalState) => Boolean(getCurrentUserId(state)));

    // Whether the user opted in to OS sync.
    // Falls back to localStorage while Redux preferences are still loading from
    // the server — prevents the theme from briefly reverting to the saved theme.
    const syncWithOS = useSelector((state: GlobalState) => {
        const key = getPreferenceKey(
            Preferences.CATEGORY_DISPLAY_SETTINGS,
            Preferences.NAME_THEME_SYNC_WITH_OS,
        );
        const pref = getMyPreferences(state)[key];
        if (pref === undefined) {
            return localSync();
        }
        return pref.value === 'true';
    });

    // The theme saved by the user in their preferences (used as the light theme
    // when OS sync is active, and as the sole theme when sync is off).
    const savedTheme = useSelector((state: GlobalState) => {
        if (isLoggedIn) {
            return getTheme(state);
        }
        return Preferences.THEMES.quartz;
    });

    // Subscribe to dark-mode changes.
    // Desktop: window.desktopAPI is present — use the native Electron API only.
    //   matchMedia events are unreliable in Electron, and getDarkMode() gives
    //   the authoritative initial value from the main process.
    // Browser: window.desktopAPI is absent — use matchMedia change events only.
    //   Never call getDarkMode() in the browser because it returns
    //   Promise.resolve(false) unconditionally, which would overwrite the
    //   correct initial osDark value obtained from matchMedia at useState time.
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const mqHandler = (e: MediaQueryListEvent) => setOsDark(e.matches);

        if (window.desktopAPI) {
            const unsubscribe = DesktopApp.onDarkModeChanged((dark) => setOsDark(dark));
            DesktopApp.getDarkMode().then((dark) => setOsDark(dark));

            // matchMedia fallback for desktop builds that don't implement onDarkModeChanged
            mq.addEventListener('change', mqHandler);

            // Polling fallback: in some Electron versions neither onDarkModeChanged
            // nor matchMedia fire reliably when the OS switches theme. Poll every 2s
            // so the theme always catches up within a moment of the OS change.
            let lastDark = osIsDarkNow();
            const pollInterval = setInterval(() => {
                DesktopApp.getDarkMode().then((dark) => {
                    if (dark !== lastDark) {
                        lastDark = dark;
                        setOsDark(dark);
                    }
                });
            }, 2000);

            return () => {
                clearInterval(pollInterval);
                mq.removeEventListener('change', mqHandler);
                unsubscribe?.();
            };
        }

        mq.addEventListener('change', mqHandler);
        return () => mq.removeEventListener('change', mqHandler);
    }, []);

    // Persist the sync preference to localStorage so the module-level init above
    // can apply the right theme immediately on the next page load.
    useEffect(() => {
        try {
            localStorage.setItem(LS_SYNC_KEY, syncWithOS ? 'true' : 'false');
        } catch {}
    }, [syncWithOS]);

    // Persist the saved (light) theme so the module-level init can apply it
    // without waiting for Redux on the next page load.
    useEffect(() => {
        if (isLoggedIn) {
            try {
                localStorage.setItem(LS_LIGHT_THEME_KEY, JSON.stringify(savedTheme));
            } catch {}
        }
    }, [savedTheme, isLoggedIn]);

    // Effective theme:
    //   sync ON + dark OS  → Onyx
    //   sync ON + light OS → user's saved light theme
    //   sync OFF           → user's saved theme
    const theme = useMemo(() => {
        if (syncWithOS && isLoggedIn) {
            return osDark ? Preferences.THEMES.onyx : savedTheme;
        }
        return savedTheme;
    }, [syncWithOS, osDark, savedTheme, isLoggedIn]);

    // Admin console must always render with the default light theme.
    // When the user navigates away, their real theme is restored automatically.
    const effectiveTheme = isAdminConsole ? Preferences.THEMES.quartz : theme;

    useEffect(() => {
        applyTheme(effectiveTheme);
    }, [effectiveTheme]);


    // Re-apply synchronously before the browser paints on every navigation
    // to prevent a flash of the wrong theme when returning from a plugin route.
    useLayoutEffect(() => {
        applyTheme(effectiveTheme);
    }, [location.pathname, effectiveTheme]);

    // Plugins/products (e.g. Playbooks) may call applyTheme in their own
    // useEffect after our useLayoutEffect. setTimeout(0) runs after all effects
    // have settled, correcting any post-paint override by the plugin bundle.
    useEffect(() => {
        const id = setTimeout(() => applyTheme(effectiveTheme), 0);
        return () => clearTimeout(id);
    }, [location.pathname, effectiveTheme]);

    const context = useMemo(() => ({
        startUsingUserTheme: () => setUsingUserTheme((count) => count + 1),
        stopUsingUserTheme: () => setUsingUserTheme((count) => count - 1),
        effectiveTheme,
    }), [effectiveTheme]);

    return (
        <ThemeContext.Provider value={context}>
            {children}
        </ThemeContext.Provider>
    );
}
