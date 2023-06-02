// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TypographyOptions} from '@mui/material/styles/createTypography';

import {getFontMargin} from '../../utils/font';

declare module '@mui/material/styles' {
    interface TypographyVariants {

        // body text variants
        b25: React.CSSProperties;
        b50: React.CSSProperties;
        b75: React.CSSProperties;
        b100: React.CSSProperties;
        b200: React.CSSProperties;
        b300: React.CSSProperties;

        // heading variants
        h25: React.CSSProperties;
        h50: React.CSSProperties;
        h75: React.CSSProperties;
        h100: React.CSSProperties;
        h200: React.CSSProperties;
        h300: React.CSSProperties;
        h400: React.CSSProperties;
        h500: React.CSSProperties;
        h600: React.CSSProperties;
        h700: React.CSSProperties;
        h800: React.CSSProperties;
        h900: React.CSSProperties;
        h1000: React.CSSProperties;
    }

    // allow configuration using `createTheme`
    interface TypographyVariantsOptions {

        // body text style properties
        b25?: React.CSSProperties;
        b50?: React.CSSProperties;
        b75?: React.CSSProperties;
        b100?: React.CSSProperties;
        b200?: React.CSSProperties;
        b300?: React.CSSProperties;

        // heading style properties
        h25?: React.CSSProperties;
        h50?: React.CSSProperties;
        h75?: React.CSSProperties;
        h100?: React.CSSProperties;
        h200?: React.CSSProperties;
        h300?: React.CSSProperties;
        h400?: React.CSSProperties;
        h500?: React.CSSProperties;
        h600?: React.CSSProperties;
        h700?: React.CSSProperties;
        h800?: React.CSSProperties;
        h900?: React.CSSProperties;
        h1000?: React.CSSProperties;
    }
}

// Update the Typography's variant prop options
declare module '@mui/material/Typography' {
    interface TypographyPropsVariantOverrides {

        // enable our custom body text variants
        b25: true;
        b50: true;
        b75: true;
        b100: true;
        b200: true;
        b300: true;

        // enable our custom heading variants
        h25: true;
        h50: true;
        h75: true;
        h100: true;
        h200: true;
        h300: true;
        h400: true;
        h500: true;
        h600: true;
        h700: true;
        h800: true;
        h900: true;
        h1000: true;

        // disable the MUI variants
        h1: false;
        h2: false;
        h3: false;
        h4: false;
        h5: false;
        h6: false;
        body1: false;
        body2: false;
        button: false;
        caption: false;
        inherit: false;
        overline: false;
        subtitle1: false;
        subtitle2: false;
    }
}

const baseBodyStyles = {
    fontFamily: 'Open Sans, sans-serif',
    fontStyle: 'normal',
    fontWeight: 400,
};

const b25 = {
    fontSize: '1rem',
    lineHeight: '1.6rem',
    marginTop: getFontMargin(10, 0.75),
    marginBottom: getFontMargin(10, 0.75),
    ...baseBodyStyles,
};
const b50 = {
    fontSize: '1.1rem',
    lineHeight: '1.6rem',
    marginTop: getFontMargin(11, 0.75),
    marginBottom: getFontMargin(11, 0.75),
    ...baseBodyStyles,
};
const b75 = {
    fontSize: '1.2rem',
    lineHeight: '1.6rem',
    marginTop: getFontMargin(12, 0.75),
    marginBottom: getFontMargin(12, 0.75),
    ...baseBodyStyles,
};
const b100 = {
    fontSize: '1.4rem',
    lineHeight: '2rem',
    marginTop: getFontMargin(14, 0.75),
    marginBottom: getFontMargin(14, 0.75),
    ...baseBodyStyles,
};
const b200 = {
    fontSize: '1.6rem',
    lineHeight: '2.4rem',
    marginTop: getFontMargin(16, 0.75),
    marginBottom: getFontMargin(16, 0.75),
    ...baseBodyStyles,
};
const b300 = {
    fontSize: '1.8rem',
    lineHeight: '2.8rem',
    marginTop: getFontMargin(18, 0.75),
    marginBottom: getFontMargin(18, 0.75),
    ...baseBodyStyles,
};

const baseHeadingStyles = {
    fontFamily: 'Metropolis, sans-serif',
    fontStyle: 'normal',
    fontWeight: 600,

    '&:first-of-type': {
        marginTop: 0,
    },
};

const h25 = {
    fontSize: '1rem',
    lineHeight: '1.6rem',
    marginTop: getFontMargin(10, 8 / 9),
    marginBottom: getFontMargin(10, 0.5),
    ...baseHeadingStyles,
    fontFamily: 'Open Sans, sans-serif',
};
const h50 = {
    fontSize: '1.1rem',
    lineHeight: '1.6rem',
    marginTop: getFontMargin(11, 8 / 9),
    marginBottom: getFontMargin(11, 0.5),
    ...baseHeadingStyles,
    fontFamily: 'Open Sans, sans-serif',
};
const h75 = {
    fontSize: '1.2rem',
    lineHeight: '1.6rem',
    marginTop: getFontMargin(12, 8 / 9),
    marginBottom: getFontMargin(12, 0.5),
    ...baseHeadingStyles,
    fontFamily: 'Open Sans, sans-serif',
};
const h100 = {
    fontSize: '1.4rem',
    lineHeight: '2rem',
    marginTop: getFontMargin(14, 8 / 9),
    marginBottom: getFontMargin(14, 0.5),
    ...baseHeadingStyles,
    fontFamily: 'Open Sans, sans-serif',
};
const h200 = {
    fontSize: '1.6rem',
    lineHeight: '2.4rem',
    marginTop: getFontMargin(16, 8 / 9),
    marginBottom: getFontMargin(16, 0.5),
    ...baseHeadingStyles,
};
const h300 = {
    fontSize: '1.8rem',
    lineHeight: '2.4rem',
    marginTop: getFontMargin(18, 8 / 9),
    marginBottom: getFontMargin(18, 0.5),
    ...baseHeadingStyles,
};
const h400 = {
    fontSize: '2rem',
    lineHeight: '2.8rem',
    marginTop: getFontMargin(18, 8 / 9),
    marginBottom: getFontMargin(18, 0.5),
    ...baseHeadingStyles,
};
const h500 = {
    fontSize: '2.2rem',
    lineHeight: '2.8rem',
    marginTop: getFontMargin(22, 8 / 9),
    marginBottom: getFontMargin(22, 0.5),
    ...baseHeadingStyles,
};
const h600 = {
    fontSize: '2.5rem',
    lineHeight: '3rem',
    marginTop: getFontMargin(25, 8 / 9),
    marginBottom: getFontMargin(25, 0.5),
    ...baseHeadingStyles,
};
const h700 = {
    fontSize: '2.8rem',
    lineHeight: '3.6rem',
    marginTop: getFontMargin(28, 8 / 9),
    marginBottom: getFontMargin(28, 0.5),
    ...baseHeadingStyles,
};
const h800 = {
    fontSize: '3.2rem',
    lineHeight: '4rem',
    marginTop: getFontMargin(32, 8 / 9),
    marginBottom: getFontMargin(32, 0.5),
    ...baseHeadingStyles,
};
const h900 = {
    fontSize: '3.6rem',
    lineHeight: '4.4rem',
    marginTop: getFontMargin(36, 8 / 9),
    marginBottom: getFontMargin(36, 0.5),
    ...baseHeadingStyles,
};
const h1000 = {
    fontSize: '4rem',
    lineHeight: '4.8rem',
    marginTop: getFontMargin(40, 8 / 9),
    marginBottom: getFontMargin(40, 0.5),
    ...baseHeadingStyles,
};

const typographyOverrides: TypographyOptions = {
    b25,
    b50,
    b75,
    b100,
    b200,
    b300,
    h25,
    h50,
    h75,
    h100,
    h200,
    h300,
    h400,
    h500,
    h600,
    h700,
    h800,
    h900,
    h1000,
};

export default typographyOverrides;
