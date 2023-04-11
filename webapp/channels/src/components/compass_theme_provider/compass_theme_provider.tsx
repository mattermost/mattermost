// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';

import LegacyThemeProvider, {lightTheme} from '@mattermost/compass-components/utilities/theme'; // eslint-disable-line no-restricted-imports
import {createPaletteFromLegacyTheme, ThemeProvider} from '@mattermost/compass-ui';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';

type Props = {
    isNewUI: boolean;
    theme: Theme;
    children?: React.ReactNode;
}

const CompassThemeProvider = ({theme, isNewUI, children}: Props): JSX.Element | null => {
    const [LegacyCompassTheme, setLegacyCompassTheme] = useState({
        ...lightTheme,
        noStyleReset: true,
        noDefaultStyle: true,
        noFontFaces: true,
    });
    const [compassTheme, setCompassTheme] = useState(createPaletteFromLegacyTheme(theme));

    useEffect(() => {
        if (isNewUI) {
            setCompassTheme(createPaletteFromLegacyTheme(theme));
        } else {
            setLegacyCompassTheme({
                ...LegacyCompassTheme,
                palette: {
                    ...LegacyCompassTheme.palette,
                    primary: {
                        ...LegacyCompassTheme.palette.primary,
                        main: theme.sidebarHeaderBg,
                        contrast: theme.sidebarHeaderTextColor,
                    },
                    alert: {
                        ...LegacyCompassTheme.palette.alert,
                        main: theme.dndIndicator,
                    },
                },
                action: {
                    ...LegacyCompassTheme.action,
                    hover: theme.sidebarHeaderTextColor,
                    disabled: theme.sidebarHeaderTextColor,
                },
                badges: {
                    ...LegacyCompassTheme.badges,
                    online: theme.onlineIndicator,
                    away: theme.awayIndicator,
                    dnd: theme.dndIndicator,
                },
                text: {
                    ...LegacyCompassTheme.text,
                    primary: theme.sidebarHeaderTextColor,
                },
            });
        }
    }, [theme]);

    if (isNewUI) {
        return (
            <ThemeProvider theme={compassTheme}>
                {children}
            </ThemeProvider>
        );
    }

    return (
        <LegacyThemeProvider theme={LegacyCompassTheme}>
            {children}
        </LegacyThemeProvider>
    );
};

export default CompassThemeProvider;
