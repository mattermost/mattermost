// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {alpha} from '@mui/material';
import {createTheme} from '@mui/material/styles';
import {Theme} from '@mattermost/types/theme';

import {THEMES} from '../../common/constants/theme';

declare module '@mui/material/styles' {
    interface Palette {
        mention?: Palette['primary'];
    }
    interface PaletteOptions {
        mention?: PaletteOptions['primary'];
    }

    interface PaletteColor {
        darker?: string;
    }
    interface SimplePaletteColorOptions {
        darker?: string;
    }
}

export const createMUIThemeFromMMTheme = (theme: Theme) =>  createTheme({
    palette: {
        primary: {main: theme.buttonBg},
        secondary: {main: theme.linkColor},
        error: {main: theme.dndIndicator},
        warning: {main: theme.awayIndicator},
        info: {main: theme.mentionHighlightBg},
        success: {main: theme.onlineIndicator},
        text: {
            primary: theme.centerChannelColor,
        },
        background: {
            default: theme.centerChannelBg,
        },
        action: {
            disabled: alpha(theme.centerChannelColor, 0.32),
            disabledBackground: alpha(theme.centerChannelColor, 0.08),
        },
        tonalOffset: 0.05,
    },
});

