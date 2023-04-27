// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {alpha} from '@mui/material';
import {createTheme} from '@mui/material/styles';

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

export const lightTheme = createTheme({
    palette:{
        primary: {main: '#e59538'},
        secondary: {main: '#0043ad'},
        error: {main: '#d24b4e'},
        warning: {main: '#cc8f00'},
        info: {main: '#145dbf'},
        success: {main: '#06d6a0'},
        mention: {main: '#145dbf'},
        text: {
            primary: '#3d3c40',
        },
        background: {
            default: '#fff',
        },
        action: {
            disabled: alpha('#3d3c40', 0.32),
            disabledBackground: alpha('#3d3c40', 0.08),
        },
        tonalOffset: 0.05,
    },
});

export const darkTheme = createTheme({
    palette: {
        primary: {main: '#aebbe3'},
        secondary: {main: '#15B7B7'},
        error: {main: '#D24B4E'},
        warning: {main: '#F5AB00'},
        info: {main: '#145dbf'},
        success: {main: '#3DB887'},
        mention: {main: '#145dbf'},
        text: {
            primary: '#f3f3f3',
        },
        background: {
            default: '#0A111F',
        },
        action: {
            disabled: alpha('#DDDFE4', 0.32),
            disabledBackground: alpha('#DDDFE4', 0.08),
        },
        tonalOffset: 0.05,
    },
});

export const createPaletteFromLegacyTheme = (theme: any) =>  createTheme({
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
