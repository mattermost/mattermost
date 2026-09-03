// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useContext, useEffect} from 'react';
import {useLocation} from 'react-router-dom';

import {TEAM_NAME_PATH_PATTERN} from 'utils/path';

export const ThemeContext = React.createContext({
    startUsingUserTheme: () => {},
    stopUsingUserTheme: () => {},
});

// Exclude System Console's integrations pages from team backstage routes.
const BACKSTAGE_ROUTE_PATTERN = new RegExp(`^/(?!admin_console)${TEAM_NAME_PATH_PATTERN}/(?:integrations|emoji)(?:/|$)`);

function isBackstageRoute(pathname: string): boolean {
    return BACKSTAGE_ROUTE_PATTERN.test(pathname);
}

/**
 * useUserTheme makes it so that the app will apply the user's theme instead of the default one for as long as the
 * calling component remains mounted.
 */
export function useUserTheme() {
    const context = useContext(ThemeContext);

    useEffect(() => {
        context.startUsingUserTheme();

        return () => {
            context.stopUsingUserTheme();
        };
    }, [context]);
}

/**
 * useAppBodyClass manages the `app__body` class on the document body for the current route while the calling
 * component remains mounted. That class is required for much of our CSS to apply the user's theme, so it is
 * omitted on backstage routes (e.g. integrations, custom emoji) that intentionally render a static light theme.
 */
export function useAppBodyClass() {
    const {pathname} = useLocation();
    const themed = !isBackstageRoute(pathname);

    useEffect(() => {
        if (!themed) {
            return undefined;
        }

        document.body.classList.add('app__body');

        return () => {
            document.body.classList.remove('app__body');
        };
    }, [themed]);
}

/**
 * WithUserTheme makes it so that the app will apply the user's theme instead of the default one for as long as it
 * remains mounted. It's used to wrap multiple routes in the Root component instead of having each of them call
 * useUserTheme separately.
 */
export function WithUserTheme({children}: {children: React.ReactNode}) {
    useUserTheme();
    useAppBodyClass();

    return children;
}
