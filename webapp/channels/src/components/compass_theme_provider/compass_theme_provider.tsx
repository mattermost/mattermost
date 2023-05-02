// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';

import CompassComponentsThemeProvider, {lightTheme} from '@mattermost/compass-components/utilities/theme'; // eslint-disable-line no-restricted-imports
import {ThemeProvider} from '@mattermost/components';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';

type Props = {
    isNewUI: boolean;
    theme: Theme;
    children?: React.ReactNode;
}

const CompassThemeProvider = ({theme, isNewUI, children}: Props): JSX.Element | null => {
    const [compassTheme, setCompassTheme] = useState({
        ...lightTheme,
        noStyleReset: true,
        noDefaultStyle: true,
        noFontFaces: true,
    });

    useEffect(() => {
        setCompassTheme({
            ...compassTheme,
            palette: {
                ...compassTheme.palette,
                primary: {
                    ...compassTheme.palette.primary,
                    main: theme.sidebarHeaderBg,
                    contrast: theme.sidebarHeaderTextColor,
                },
                alert: {
                    ...compassTheme.palette.alert,
                    main: theme.dndIndicator,
                },
            },
            action: {
                ...compassTheme.action,
                hover: theme.sidebarHeaderTextColor,
                disabled: theme.sidebarHeaderTextColor,
            },
            badges: {
                ...compassTheme.badges,
                online: theme.onlineIndicator,
                away: theme.awayIndicator,
                dnd: theme.dndIndicator,
            },
            text: {
                ...compassTheme.text,
                primary: theme.sidebarHeaderTextColor,
            },
        });
    }, [theme]);

    if (isNewUI) {
        return (
            <ThemeProvider theme={theme}>
                {children}
            </ThemeProvider>
        );
    }

    return (
        <CompassComponentsThemeProvider theme={compassTheme}>
            {children}
        </CompassComponentsThemeProvider>
    );
};

export default CompassThemeProvider;
