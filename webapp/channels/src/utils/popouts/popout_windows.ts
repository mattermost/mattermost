// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import type {PopoutViewProps} from '@mattermost/desktop-api';

import DesktopApp from 'utils/desktop_api';
import {isDesktopApp} from 'utils/user_agent';

import BrowserPopouts from './browser_popouts';

export const canPopout = Boolean(!isDesktopApp() || DesktopApp.canPopout());

export function popoutThread(intl: IntlShape, threadId: string, teamName: string) {
    return popout(
        `/_popout/thread/${teamName}/${threadId}`,
        {
            isRHS: true,
            titleTemplate: intl.formatMessage({id: 'thread_popout.title', defaultMessage: 'Thread - {channelName} - {teamName}'}),
        },
    );
}

/**
 * Below this is generic popout code
 * You likely do not need to add anything below this.
 */

type PopoutListeners = {
    send: (channel: string, ...args: unknown[]) => void;
    message: (listener: (channel: string, ...args: unknown[]) => void) => void;
    closed: (listener: () => void) => void;
};

async function popout(path: string, desktopProps?: PopoutViewProps): Promise<Partial<PopoutListeners>> {
    if (isDesktopApp()) {
        return DesktopApp.setupDesktopPopout(path, desktopProps);
    }

    return Promise.resolve(BrowserPopouts.setupBrowserPopout(path));
}

export function sendToParent(channel: string, ...args: unknown[]) {
    if (isDesktopApp()) {
        return DesktopApp.sendToParentWindow(channel, ...args);
    }

    return BrowserPopouts.sendToParent(channel, ...args);
}

export function onMessageFromParent(listener: (channel: string, ...args: unknown[]) => void) {
    if (isDesktopApp()) {
        return DesktopApp.onMessageFromParentWindow(listener);
    }

    return BrowserPopouts.onMessageFromParent(listener);
}

