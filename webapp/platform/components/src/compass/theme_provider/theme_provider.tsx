// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createTheme, ThemeProvider as MUIThemeProvider} from '@mui/material/styles';
import {Theme} from "@mattermost/types/theme";

import {createMUIThemeFromMMTheme} from './themes';

import {THEMES} from '../../common/constants/theme';
import overrides from './overrides';

type Props = {
    theme: Theme;
}

const Theme_provider = ({theme = THEMES.onyx}: Props) => {
    const MUITheme = createMUIThemeFromMMTheme(theme);
    const combinedTheme = createTheme({
        ...MUITheme,
        ...overrides,
    });

    return (
        <MUIThemeProvider
            theme={combinedTheme}
        />
    );
};

export default Theme_provider;
