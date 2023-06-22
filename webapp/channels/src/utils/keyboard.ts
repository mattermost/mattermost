// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import Constants from 'utils/constants';
import * as UserAgent from 'utils/user_agent';

export function cmdOrCtrlPressed(e: React.KeyboardEvent | KeyboardEvent, allowAlt = false) {
    const isMac = UserAgent.isMac();

    if (allowAlt) {
        return (isMac && e.metaKey) || (!isMac && e.ctrlKey);
    }
    return (isMac && e.metaKey) || (!isMac && e.ctrlKey && !e.altKey);
}

export function isKeyPressed(event: React.KeyboardEvent | KeyboardEvent, key: [string, number]) {
    // There are two types of keyboards
    // 1. English with different layouts(Ex: Dvorak)
    // 2. Different language keyboards(Ex: Russian)

    if (event.keyCode === Constants.KeyCodes.COMPOSING[1]) {
        return false;
    }

    // checks for event.key for older browsers and also for the case of different English layout keyboards.
    if (typeof event.key !== 'undefined' && event.key !== 'Unidentified' && event.key !== 'Dead') {
        const isPressedByCode = event.key === key[0] || event.key === key[0].toUpperCase();
        if (isPressedByCode) {
            return true;
        }
    }

    // used for different language keyboards to detect the position of keys
    return event.keyCode === key[1];
}
