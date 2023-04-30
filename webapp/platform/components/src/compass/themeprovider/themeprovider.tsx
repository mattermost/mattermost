// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createTheme, ThemeProvider as MUIThemeProvider} from '@mui/material/styles';

import {lightTheme} from './themes';
import overrides from './overrides';

const ThemeProvider = ({theme = lightTheme, ...rest}) => {
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
