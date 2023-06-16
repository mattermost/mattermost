// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import bing from 'sounds/bing.mp3';
import crackle from 'sounds/crackle.mp3';
import down from 'sounds/down.mp3';
import hello from 'sounds/hello.mp3';
import ripple from 'sounds/ripple.mp3';
import upstairs from 'sounds/upstairs.mp3';
import calls_dynamic from 'sounds/calls_dynamic.mp3';
import calls_calm from 'sounds/calls_calm.mp3';
import calls_urgent from 'sounds/calls_urgent.mp3';
import calls_cheerful from 'sounds/calls_cheerful.mp3';

import * as UserAgent from 'utils/user_agent';

export const notificationSounds = new Map([
    ['Bing', bing],
    ['Crackle', crackle],
    ['Down', down],
    ['Hello', hello],
    ['Ripple', ripple],
    ['Upstairs', upstairs],
]);

export const callsNotificationSounds = new Map([
    ['Dynamic', calls_dynamic],
    ['Calm', calls_calm],
    ['Urgent', calls_urgent],
    ['Cheerful', calls_cheerful],
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

let currentRing: HTMLAudioElement | null = null;
export function ring(name: string) {
    if (!hasSoundOptions()) {
        return;
    }
    stopRing();

    currentRing = loopNotificationRing(name);
    currentRing.addEventListener('pause', () => {
        stopRing();
    });
}

export function stopRing() {
    if (currentRing) {
        currentRing.pause();
        currentRing.src = '';
        currentRing.remove();
        currentRing = null;
    }
}

let currentTryRing: HTMLAudioElement | null = null;
let currentTimer: NodeJS.Timeout;
export function tryNotificationRing(name: string) {
    if (!hasSoundOptions()) {
        return;
    }
    stopTryNotificationRing();
    clearTimeout(currentTimer);

    currentTryRing = loopNotificationRing(name);
    currentTryRing.addEventListener('pause', () => {
        stopTryNotificationRing();
    });

    currentTimer = setTimeout(() => {
        stopTryNotificationRing();
    }, 5000);
}

export function stopTryNotificationRing() {
    if (currentTryRing) {
        currentTryRing.pause();
        currentTryRing.src = '';
        currentTryRing.remove();
        currentTryRing = null;
    }
}

export function loopNotificationRing(name: string) {
    const audio = new Audio(callsNotificationSounds.get(name) ?? callsNotificationSounds.get('Dynamic'));
    audio.loop = true;
    audio.play();
    return audio;
}

export function hasSoundOptions() {
    return (!UserAgent.isEdge());
}
