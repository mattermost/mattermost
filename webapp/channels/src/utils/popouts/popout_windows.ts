// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import type {PopoutViewProps} from '@mattermost/desktop-api';

import {Client4} from 'mattermost-redux/client';

import DesktopApp from 'utils/desktop_api';
import {isDesktopApp} from 'utils/user_agent';

import BrowserPopouts from './browser_popouts';
import {
    sendToParent as sendToParentBrowser,
    onMessageFromParent as onMessageFromParentBrowser,
} from './use_browser_popout';

export const FOCUS_REPLY_POST = 'focus-reply-post';
export async function popoutThread(
    intl: IntlShape,
    threadId: string,
    teamName: string,
    onFocusPost: (postId: string, returnTo: string) => void,
) {
    const popoutListeners = await popout(
        `/_popout/thread/${teamName}/${threadId}`,
        {
            isRHS: true,
            titleTemplate: intl.formatMessage({
                id: 'thread_popout.title',
                defaultMessage: 'Thread - {channelName} - {teamName}',
            }),
        },
    );

    popoutListeners?.onMessageFromPopout?.((channel: string, ...args: unknown[]) => {
        if (channel === FOCUS_REPLY_POST) {
            const [postId, returnTo] = args;
            onFocusPost(
                postId as string,
                returnTo as string,
            );
        }
    });

    return popoutListeners;
}

/**
 * Below this is generic popout code
 * You likely do not need to add anything below this.
 */

type PopoutListeners = {
    sendToPopout: (channel: string, ...args: unknown[]) => void;
    onMessageFromPopout: (listener: (channel: string, ...args: unknown[]) => void) => void;
    onClosePopout: (listener: () => void) => void;
};

async function popout(
    path: string,
    desktopProps?: PopoutViewProps,
): Promise<Partial<PopoutListeners>> {
    if (isDesktopApp()) {
        return DesktopApp.setupDesktopPopout(path, desktopProps);
    }

    return Promise.resolve(BrowserPopouts.setupBrowserPopout(path));
}

export function sendToParent(channel: string, ...args: unknown[]) {
    if (isDesktopApp()) {
        return DesktopApp.sendToParentWindow(channel, ...args);
    }

    return sendToParentBrowser(channel, ...args);
}

export function onMessageFromParent(listener: (channel: string, ...args: unknown[]) => void) {
    if (isDesktopApp()) {
        return DesktopApp.onMessageFromParentWindow(listener);
    }

    return onMessageFromParentBrowser(listener);
}

export function isPopoutWindow() {
    return window.location.href.startsWith(`${Client4.getUrl()}/_popout/`);
}

export function canPopout() {
    return Boolean(!isDesktopApp() || DesktopApp.canPopout());
}
