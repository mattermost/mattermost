// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import semver from 'semver';

import type {Channel} from '@mattermost/types/channels';

import {isDesktopApp} from 'utils/user_agent';

// TODO: Temporary typings
declare global {
    interface Window {
        desktopAPI?: {
            isDev?: () => Promise<boolean>;
        };
    }
}

class DesktopApp {
    private name?: string;
    private version?: string | null;
    private dev?: boolean;

    /**
     * @deprecated
     */
    private postMessageListeners: Map<string, Set<(message: unknown) => void>>;

    constructor() {
        // Legacy code - to be removed
        this.postMessageListeners = new Map();
        window.addEventListener('message', this.postMessageListener);
        window.addEventListener('beforeunload', () => {
            window.removeEventListener('message', this.postMessageListener);
        });

        // Check the user agent string first
        if (!isDesktopApp()) {
            return;
        }

        this.getDesktopAppInfo().then(({name, version}) => {
            this.name = name;
            this.version = semver.valid(semver.coerce(version));

            // Legacy code, not sure if it's still used by plugins?
            // Remove if not
            if (!window.desktop) {
                window.desktop = {};
            }
            window.desktop.version = semver.valid(semver.coerce(version));
        });
        window.desktopAPI?.isDev?.().then((isDev) => {
            this.dev = isDev;
        });
    }

    getAppName = () => {
        return this.name;
    };

    getAppVersion = () => {
        return this.version;
    };

    isDev = () => {
        return this.dev;
    };

    private getDesktopAppInfo = () => {
        return this.invokeWithMessaging<void, {name: string; version: string}>(
            'webapp-ready',
            undefined,
            'register-desktop',
        );
    };

    /**
     * @deprecated
     */
    private postMessageListener = ({origin, data: {type, message}}: {origin: string; data: {type: string; message: unknown}}) => {
        if (origin !== window.location.origin) {
            return;
        }

        const listeners = this.postMessageListeners.get(type);
        if (!listeners) {
            return;
        }

        listeners.forEach((listener) => {
            listener(message);
        });
    };

    /**
     * @deprecated
     */
    addPostMessageListener = (channel: string, listener: (message: any) => void) => {
        if (this.postMessageListeners.has(channel)) {
            this.postMessageListeners.set(channel, this.postMessageListeners.get(channel)!.add(listener));
        } else {
            this.postMessageListeners.set(channel, new Set([listener]));
        }
    };

    /**
     * @deprecated
     */
    removePostMessageListener = (channel: string, listener: (message: any) => void) => {
        const set = this.postMessageListeners.get(channel);
        set?.delete(listener);
        if (set?.size) {
            this.postMessageListeners.set(channel, set);
        } else {
            this.postMessageListeners.delete(channel);
        }
    };

    /**
     * @deprecated
     */
    invokeWithMessaging = <T, T2>(
        sendChannel: string,
        sendData?: T,
        receiveChannel?: string,
    ) => {
        return new Promise<T2>((resolve) => {
            /* create and register a temporary listener if necessary */
            const response = ({origin, data: {type, message}}: {origin: string; data: {type: string; message: T2}}) => {
                /* ignore messages from other frames */
                if (origin !== window.location.origin) {
                    return;
                }

                /* ignore messages from other channels */
                if (type !== (receiveChannel ?? sendChannel)) {
                    return;
                }

                /* clean up listener and resolve */
                window.removeEventListener('message', response);
                resolve(message);
            };

            window.addEventListener('message', response);
            window.postMessage(
                {type: sendChannel, message: sendData},
                window.location.origin,
            );
        });
    };
}

const desktopApp = new DesktopApp();
export default desktopApp;

/*******************************
 * API Methods
 *******************************/

/**
 * Invokes
 */

export const doBrowserHistoryPush = (path: string) => {
    // This weird hacky code is to get around the fact that we allow for both an two-way invoke
    // between the two apps (this function) and a one way listener for the Web App to the Desktop App
    // Since we reused the same channel twice, we have to remove the one way listeners while the invoke happens
    // This code should all be removed when we remove message passing completely
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const returnListeners = desktopApp.postMessageListeners.get('browser-history-push-return');
    returnListeners?.forEach((listener) => desktopApp.removePostMessageListener('browser-history-push-return', listener));

    return desktopApp.invokeWithMessaging<{path: string}, {pathName?: string}>(
        'browser-history-push',
        {path},
        'browser-history-push-return',
    ).then((result) => {
        // Restore the attached listeners
        returnListeners?.forEach((listener) => desktopApp.addPostMessageListener('browser-history-push-return', listener));
        return result;
    });
};

export const getBrowserHistoryStatus = () => {
    return desktopApp.invokeWithMessaging<void, {enableBack: boolean; enableForward: boolean}>(
        'history-button',
        undefined,
        'history-button-return',
    );
};

/**
 * Listeners
 */

export const onUserActivityUpdate = (listener: (userIsActive: boolean, manual: boolean) => void) => {
    const legacyListener = ({userIsActive, manual}: {userIsActive: boolean; manual: boolean}) => listener(userIsActive, manual);
    desktopApp.addPostMessageListener('user-activity-update', legacyListener);

    return () => desktopApp.removePostMessageListener('user-activity-update', legacyListener);
};

export const onNotificationClicked = (listener: (channel: Channel, teamId: string, url: string) => void) => {
    const legacyListener = ({channel, teamId, url}: {channel: Channel; teamId: string; url: string}) => listener(channel, teamId, url);
    desktopApp.addPostMessageListener('notification-clicked', legacyListener);

    return () => desktopApp.removePostMessageListener('notification-clicked', legacyListener);
};

export const onBrowserHistoryPush = (listener: (pathName: string) => void) => {
    const legacyListener = ({pathName}: {pathName: string}) => listener(pathName);
    desktopApp.addPostMessageListener('browser-history-push-return', legacyListener);

    return () => desktopApp.removePostMessageListener('browser-history-push-return', legacyListener);
};

export const onBrowserHistoryStatusUpdated = (listener: (enableBack: boolean, enableForward: boolean) => void) => {
    const legacyListener = ({enableBack, enableForward}: {enableBack: boolean; enableForward: boolean}) => listener(enableBack, enableForward);
    desktopApp.addPostMessageListener('history-button-return', legacyListener);

    return () => desktopApp.removePostMessageListener('history-button-return', legacyListener);
};

/**
 * One-ways
 */

export const dispatchNotification = (
    title: string,
    body: string,
    channel: Channel,
    teamId: string,
    silent: boolean,
    soundName: string,
    url: string,
) => {
    // get the desktop app to trigger the notification
    window.postMessage(
        {
            type: 'dispatch-notification',
            message: {
                title,
                body,
                channel,
                teamId,
                silent,
                data: {soundName},
                url,
            },
        },
        window.location.origin,
    );
};
