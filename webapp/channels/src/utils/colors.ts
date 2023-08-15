// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Values taken from https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
const COEFFICIENTS_OF_CIE_COLOR_SPACE = {
    RED: 0.2126,
    GREEN: 0.7152,
    BLUE: 0.0722,
};
const GAMMA_CORRECTION = 2.4;

// See https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
function calculateRelativeLuminance(red: number, green: number, blue: number) {
    const gammaCorrectedScaledColors = [red, green, blue].map((color) => {
        const scaledColor = color / 255;

        if (scaledColor <= 0.03928) {
            return scaledColor / 12.92;
        }

        return Math.pow((scaledColor + 0.055) / 1.055, GAMMA_CORRECTION);
    });

    return sumRGBContributions(gammaCorrectedScaledColors[0], gammaCorrectedScaledColors[1], gammaCorrectedScaledColors[2]);
}

function sumRGBContributions(gammaCorrectedRed: number, gammaCorrectedGreen: number, gammaCorrectedBlue: number) {
    const contributionsofRedChannel = COEFFICIENTS_OF_CIE_COLOR_SPACE.RED * gammaCorrectedRed;
    const contributionsofGreenChannel = COEFFICIENTS_OF_CIE_COLOR_SPACE.GREEN * gammaCorrectedGreen;
    const contributionsofBlueChannel = COEFFICIENTS_OF_CIE_COLOR_SPACE.BLUE * gammaCorrectedBlue;

    return contributionsofRedChannel + contributionsofGreenChannel + contributionsofBlueChannel;
}

// See https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
export function calculateContrastRatio(backgroundRGB: number[], foregroundRGB: number[]) {
    const relativeLuminanceOfBackground = calculateRelativeLuminance(backgroundRGB[0], backgroundRGB[1], backgroundRGB[2]);
    const relativeLuminanceOfForeground = calculateRelativeLuminance(foregroundRGB[0], foregroundRGB[1], foregroundRGB[2]);

    // Adds small adjustment to avoid divide by zero errors.
    const greatestOfTwoRelativeLuminance = Math.max(relativeLuminanceOfBackground, relativeLuminanceOfForeground) + 0.05;
    const smalledOfTwoRelativeLuminance = Math.min(relativeLuminanceOfBackground, relativeLuminanceOfForeground) + 0.05;

    return (greatestOfTwoRelativeLuminance) / (smalledOfTwoRelativeLuminance);
}
