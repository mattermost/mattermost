// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

import ThemeProvider, {lightTheme} from '@mattermost/compass-components/utilities/theme'; // eslint-disable-line no-restricted-imports

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

type Props = {
    theme: Theme;
    children?: React.ReactNode;
}

const CompassThemeProvider = ({
    theme,
    children,
}: Props) => {
    const compassTheme = useMemo(() => {
        const base = {
            ...lightTheme,
            noStyleReset: true,
            noDefaultStyle: true,
            noFontFaces: true,
        };

        return {
            ...base,
            palette: {
                ...base.palette,
                primary: {
                    ...base.palette.primary,
                    main: theme.sidebarHeaderBg,
                    contrast: theme.sidebarHeaderTextColor,
                },
                alert: {
                    ...base.palette.alert,
                    main: theme.dndIndicator,
                },
            },
            action: {
                ...base.action,
                hover: theme.sidebarHeaderTextColor,
                disabled: theme.sidebarHeaderTextColor,
            },
            badges: {
                ...base.badges,
                online: theme.onlineIndicator,
                away: theme.awayIndicator,
                dnd: theme.dndIndicator,
            },
            text: {
                ...base.text,
                primary: theme.sidebarHeaderTextColor,
            },
        };
    }, [theme]);

    return (
        <ThemeProvider theme={compassTheme}>
            {children}
        </ThemeProvider>
    );
};

export default CompassThemeProvider;
