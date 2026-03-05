// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PopoutViewProps} from '@mattermost/desktop-api';

import {Client4} from 'mattermost-redux/client';

import DesktopApp from 'utils/desktop_api';
import {getBasePath} from 'utils/url';
import {isDesktopApp} from 'utils/user_agent';

import BrowserPopouts from './browser_popouts';
import {
    sendToParent as sendToParentBrowser,
    onMessageFromParent as onMessageFromParentBrowser,
} from './use_browser_popout';

const pluginPopoutListeners: Map<string, (teamName: string, channelName: string, listeners: Partial<PopoutListeners>) => void> = new Map();
export function registerRHSPluginPopoutListener(pluginId: string, onPopoutOpened: (teamName: string, channelName: string, listeners: Partial<PopoutListeners>) => void) {
    pluginPopoutListeners.set(pluginId, onPopoutOpened);
}

export const FOCUS_REPLY_POST = 'focus-reply-post';
export async function popoutThread(
    titleTemplate: string,
    threadId: string,
    teamName: string,
    onFocusPost: (postId: string, returnTo: string) => void,
) {
    const popoutListeners = await popout(
        `${getBasePath()}/_popout/thread/${teamName}/${threadId}`,
        {
            isRHS: true,
            titleTemplate,
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

export async function popoutRhsPlugin(
    titleTemplate: string,
    pluginId: string,
    teamName: string,
    channelName: string,
) {
    const listeners = await popout(
        `${getBasePath()}/_popout/rhs/${teamName}/${channelName}/plugin/${pluginId}`,
        {
            isRHS: true,
            titleTemplate,
        },
    );

    pluginPopoutListeners.get(pluginId)?.(teamName, channelName, listeners);

    return listeners;
}

export async function popoutHelp() {
    return popout(
        '/_popout/help',
        {

            // Not really RHS, but this gives a desirable window size.
            isRHS: true,

            // Note: titleTemplate is intentionally omitted so that the desktop
            // app uses document.title, allowing dynamic title updates as the
            // user navigates between help pages.
        },
    );
}

/**
 * Below this is generic popout code
 * You likely do not need to add anything below this.
 */

export type PopoutListeners = {
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

export function isThreadPopoutWindow(teamName: string, threadId: string) {
    return window.location.href.startsWith(`${Client4.getUrl()}/_popout/thread/${teamName}/${threadId}`);
}

export function canPopout() {
    return Boolean(!isDesktopApp() || DesktopApp.canPopout());
}
