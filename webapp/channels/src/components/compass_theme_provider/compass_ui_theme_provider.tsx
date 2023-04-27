// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {createTheme} from '@mui/material/styles';
import MUIThemeProvider, {ThemeProviderProps as MUIThemeProviderProps} from '@mui/material/styles/ThemeProvider';

import componentOverrides from './component_overrides';

export type ThemeProviderProps = Omit<MUIThemeProviderProps, 'theme'>;

const CompassUIThemeProvider = (props: ThemeProviderProps) => {
    const theme = createTheme({
        components: componentOverrides,
    });

    return (
        <MUIThemeProvider
            {...props}
            theme={theme}
        />
    );
};

export default CompassUIThemeProvider;
