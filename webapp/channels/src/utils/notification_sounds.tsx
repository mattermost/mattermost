// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {ChannelNotifyProps} from '@mattermost/types/channels';
import type {UserNotifyProps} from '@mattermost/types/users';

import bing from 'sounds/bing.mp3';
import calls_calm from 'sounds/calls_calm.mp3';
import calls_cheerful from 'sounds/calls_cheerful.mp3';
import calls_dynamic from 'sounds/calls_dynamic.mp3';
import calls_urgent from 'sounds/calls_urgent.mp3';
import crackle from 'sounds/crackle.mp3';
import down from 'sounds/down.mp3';
import hello from 'sounds/hello.mp3';
import ripple from 'sounds/ripple.mp3';
import upstairs from 'sounds/upstairs.mp3';
import {DesktopSound} from 'utils/constants';
import * as UserAgent from 'utils/user_agent';

export const DesktopNotificationSounds = {
    DEFAULT: 'default',
    BING: 'Bing',
    CRACKLE: 'Crackle',
    DOWN: 'Down',
    HELLO: 'Hello',
    RIPPLE: 'Ripple',
    UPSTAIRS: 'Upstairs',
} as const;

export const notificationSounds = new Map<string, string>([
    [DesktopNotificationSounds.BING, bing],
    [DesktopNotificationSounds.CRACKLE, crackle],
    [DesktopNotificationSounds.DOWN, down],
    [DesktopNotificationSounds.HELLO, hello],
    [DesktopNotificationSounds.RIPPLE, ripple],
    [DesktopNotificationSounds.UPSTAIRS, upstairs],
]);

export const notificationSoundKeys = Array.from(notificationSounds.keys());

export const optionsOfMessageNotificationSoundsSelect: Array<{value: string; label: ReactNode}> = notificationSoundKeys.map((soundName) => {
    if (soundName === DesktopNotificationSounds.BING) {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundBing'
                    defaultMessage='Bing'
                />
            ),
        };
    } else if (soundName === DesktopNotificationSounds.CRACKLE) {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundCrackle'
                    defaultMessage='Crackle'
                />
            ),
        };
    } else if (soundName === DesktopNotificationSounds.DOWN) {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundDown'
                    defaultMessage='Down'
                />
            ),
        };
    } else if (soundName === DesktopNotificationSounds.HELLO) {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundHello'
                    defaultMessage='Hello'
                />
            ),
        };
    } else if (soundName === DesktopNotificationSounds.RIPPLE) {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundRipple'
                    defaultMessage='Ripple'
                />
            ),
        };
    } else if (soundName === DesktopNotificationSounds.UPSTAIRS) {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundUpstairs'
                    defaultMessage='Upstairs'
                />
            ),
        };
    }
    return {
        value: '',
        label: '',
    };
});

export function getValueOfNotificationSoundsSelect(soundName?: string) {
    const soundOption = optionsOfMessageNotificationSoundsSelect.find((option) => option.value === soundName);

    if (!soundOption) {
        return undefined;
    }

    return soundOption;
}

export const callsNotificationSounds = new Map([
    ['Dynamic', calls_dynamic],
    ['Calm', calls_calm],
    ['Urgent', calls_urgent],
    ['Cheerful', calls_cheerful],
]);

export const callNotificationSoundKeys = Array.from(callsNotificationSounds.keys());

export const optionsOfIncomingCallSoundsSelect: Array<{value: string; label: ReactNode}> = callNotificationSoundKeys.map((soundName) => {
    if (soundName === 'Dynamic') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundDynamic'
                    defaultMessage='Dynamic'
                />
            ),
        };
    } else if (soundName === 'Calm') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundCalm'
                    defaultMessage='Calm'
                />
            ),
        };
    } else if (soundName === 'Urgent') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundUrgent'
                    defaultMessage='Urgent'
                />
            ),
        };
    } else if (soundName === 'Cheerful') {
        return {
            value: soundName,
            label: (
                <FormattedMessage
                    id='user.settings.notifications.desktopNotificationSound.soundCheerful'
                    defaultMessage='Cheerful'
                />
            ),
        };
    }
    return {
        value: '',
        label: '',
    };
});

export function getValueOfIncomingCallSoundsSelect(soundName?: string) {
    const soundOption = optionsOfIncomingCallSoundsSelect.find((option) => option.value === soundName);

    if (!soundOption) {
        return undefined;
    }

    return soundOption;
}

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
    const audio = new Audio(callsNotificationSounds.get(name) ?? callsNotificationSounds.get('Calm'));
    audio.loop = true;
    audio.play();
    return audio;
}

export function hasSoundOptions() {
    return (!UserAgent.isEdge());
}

/**
 * This conversion is needed because User's preference for desktop sound is stored as either true or false. On the other hand,
 * Channel's specific desktop sound is stored as either On or Off.
 */
export function convertDesktopSoundNotifyPropFromUserToDesktop(userNotifyDesktopSound?: UserNotifyProps['desktop_sound']): ChannelNotifyProps['desktop_sound'] {
    if (userNotifyDesktopSound && userNotifyDesktopSound === 'false') {
        return DesktopSound.OFF;
    }

    return DesktopSound.ON;
}
