// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Typography as MuiTypography, TypographyProps as MuiTypographyProps} from '@mui/material';

type Props = Omit<MuiTypographyProps, 'variantMapping' | 'paragraph'> & {
    gutterTop?: boolean;
}

const Typography = ({variant = 'b100', ...props}: Props) => {
    const variantMap = {
        b25: 'p',
        b50: 'p',
        b75: 'p',
        b100: 'p',
        b200: 'p',
        b300: 'p',

        h25: 'h6',
        h50: 'h6',
        h75: 'h6',
        h100: 'h5',
        h200: 'h5',
        h300: 'h4',
        h400: 'h4',
        h500: 'h3',
        h600: 'h3',
        h700: 'h2',
        h800: 'h2',
        h900: 'h1',
        h1000: 'h1',
    };

    return (
        <MuiTypography
            {...props}
            variant={variant}
            variantMapping={variantMap}
        />
    );
};

export default Typography;
