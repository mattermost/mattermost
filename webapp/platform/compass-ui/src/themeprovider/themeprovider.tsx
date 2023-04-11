// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createTheme} from '@mui/material/styles';
import MUIThemeProvider, {ThemeProviderProps} from '@mui/material/styles/ThemeProvider';

import {lightTheme} from './themes';
import overrides from './overrides';

const ThemeProvider = ({theme = lightTheme, ...rest}: ThemeProviderProps) => {
    const combinedTheme = createTheme({
        ...theme,
        ...overrides,
    });

    return (
        <MUIThemeProvider
            {...rest}
            theme={combinedTheme}
        />
    );
};

export default ThemeProvider;
