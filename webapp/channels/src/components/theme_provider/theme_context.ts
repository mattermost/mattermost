// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useContext, useEffect} from 'react';

export const ThemeContext = React.createContext({
    startUsingUserTheme: () => {},
    stopUsingUserTheme: () => {},
});

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
 * useAppBodyClass manages the `app__body` class on the document body for as long as the calling component
 * remains mounted. That class is required for much of our CSS to apply the user's theme, so it should be used
 * wherever those should be used.
 */
export function useAppBodyClass() {
    useEffect(() => {
        document.body.classList.add('app__body');

        return () => {
            document.body.classList.remove('app__body');
        };
    }, []);
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
