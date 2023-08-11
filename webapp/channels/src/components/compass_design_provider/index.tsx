// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useMemo} from 'react';
import type {FC, ReactNode} from 'react';

import {createTheme, ThemeProvider, useTheme as useDefaultMuiTheme, alpha} from '@mui/material/styles';
import type {Theme as MuiTheme} from '@mui/material/styles';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

interface Props {
    theme?: Theme;
    children?: ReactNode;
}

const CompassDesignProvider: FC<Props> = (props: Props) => {
    const defaultMuiTheme = useDefaultMuiTheme();

    const theme = useMemo<MuiTheme>(() => createTheme({
        palette: {
            background: {
                paper: props.theme?.centerChannelBg ?? defaultMuiTheme.palette.background.paper,
            },
            divider: alpha(props.theme?.centerChannelColor ?? defaultMuiTheme.palette.divider, 0.08),
        },
    }), [props?.theme]);

    return <ThemeProvider theme={theme}>{props.children}</ThemeProvider>;
};

export default memo(CompassDesignProvider);
