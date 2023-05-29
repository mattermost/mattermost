// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import bing from 'sounds/bing.mp3';
import crackle from 'sounds/crackle.mp3';
import down from 'sounds/down.mp3';
import hello from 'sounds/hello.mp3';
import ripple from 'sounds/ripple.mp3';
import upstairs from 'sounds/upstairs.mp3';

import * as UserAgent from 'utils/user_agent';

export const notificationSounds = new Map([
    ['Bing', bing],
    ['Crackle', crackle],
    ['Down', down],
    ['Hello', hello],
    ['Ripple', ripple],
    ['Upstairs', upstairs],
]);

let canDing = true;
export function ding(name: string) {
    if (hasSoundOptions() && canDing) {
        tryNotificationSound(name);
        canDing = false;
        setTimeout(() => {
            canDing = true;
        }, 3000);
    }
}

export function tryNotificationSound(name: string) {
    const audio = new Audio(notificationSounds.get(name) ?? notificationSounds.get('Bing'));
    audio.play();
}

export function hasSoundOptions() {
    return (!UserAgent.isEdge());
}
