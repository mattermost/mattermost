// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import ColorContrastChecker from 'color-contrast-checker';
import ColorHash from 'color-hash';

const cachedColors = new Map<string, string>();

export function generateColor(username: string, background: string): string {
    const cacheKey = `${username}-${background}`;
    const cachedColor = cachedColors.get(cacheKey);
    if (cachedColor) {
        return cachedColor;
    }

    let userColor = background;
    let userAndSalt = username;
    const checker = new ColorContrastChecker();
    const colorHash = new ColorHash();

    let tries = 3;
    while (!checker.isLevelCustom(userColor, background, 4.5) && tries > 0) {
        userColor = colorHash.hex(userAndSalt);
        userAndSalt += 'salt';
        tries--;
    }

    cachedColors.set(cacheKey, userColor);
    return userColor;
}
