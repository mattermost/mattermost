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
 * WithUserTheme makes it so that the app will apply the user's theme instead of the default one for as long as it
 * remains mounted. It's used to wrap multiple routes in the Root component instead of having each of them call
 * useUserTheme separately.
 */
export function WithUserTheme({children}: {children: React.ReactNode}) {
    useUserTheme();

    return children;
}
