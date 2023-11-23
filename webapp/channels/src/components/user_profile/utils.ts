// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ColorContrastChecker from 'color-contrast-checker';
import ColorHash from 'color-hash';

const REQUIRED_COLOR_RATIO = 4.5;

export const cachedUserNameColors = new Map<string, string>();

export function generateColor(username: string, background: string): string {
    const cacheKey = `${username}-${background}`;
    const cachedColor = cachedUserNameColors.get(cacheKey);
    if (cachedColor) {
        return cachedColor;
    }

    let userColor = background;
    let contrastRatio = 1;
    let userAndSalt = username;
    const checker = new ColorContrastChecker();
    const colorHash = new ColorHash();

    const backgroundLuminance = checker.hexToLuminance(background);
    for (let tries = 10; tries > 0; tries--) {
        const textColor = colorHash.hex(userAndSalt);

        const cr = checker.getContrastRatio(
            checker.hexToLuminance(textColor),
            backgroundLuminance,
        );

        if (cr > contrastRatio) {
            userColor = textColor;
            contrastRatio = cr;
        }

        if (cr >= REQUIRED_COLOR_RATIO) {
            break;
        }

        userAndSalt += 'salt';
    }

    cachedUserNameColors.set(cacheKey, userColor);
    return userColor;
}
