// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import semver from 'semver';

import type {DesktopAPI} from '@mattermost/desktop-api';

import {isDesktopApp} from 'utils/user_agent';

declare global {
    interface Window {
        desktopAPI?: Partial<DesktopAPI>;
    }
}

class DesktopAppAPI {
    private name?: string;
    private version?: string | null;
    private dev?: boolean;

    /**
     * @deprecated
     */
    private postMessageListeners?: Map<string, Set<(message: unknown) => void>>;

    constructor() {
        // Check the user agent string first
        if (!isDesktopApp()) {
            return;
        }

        this.getDesktopAppInfo().then(({name, version}) => {
            this.name = name;
            this.version = semver.valid(semver.coerce(version));

            // Legacy Desktop App version, used by some plugins
            if (!window.desktop) {
                window.desktop = {};
            }
            window.desktop.version = semver.valid(semver.coerce(version));
        });
        window.desktopAPI?.isDev?.().then((isDev) => {
            this.dev = isDev;
        });

        // Legacy code - to be removed
        this.postMessageListeners = new Map();
        window.addEventListener('message', this.postMessageListener);
        window.addEventListener('beforeunload', () => {
            window.removeEventListener('message', this.postMessageListener);
        });
    }

    /*******************************************************
     * Getters/setters for Desktop App specific information
     *******************************************************/

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
        if (window.desktopAPI?.getAppInfo) {
            return window.desktopAPI.getAppInfo();
        }

        return this.invokeWithMessaging<void, {name: string; version: string}>(
            'webapp-ready',
            undefined,
            'register-desktop',
        );
    };

    /**********************
     * Exposed API methods
     **********************/

    /**
     * Invokes
     */

    getBrowserHistoryStatus = async () => {
        if (window.desktopAPI?.requestBrowserHistoryStatus) {
            return window.desktopAPI.requestBrowserHistoryStatus();
        }

        const {enableBack, enableForward} = await this.invokeWithMessaging<void, {enableBack: boolean; enableForward: boolean}>(
            'history-button',
            undefined,
            'history-button-return',
        );

        return {
            canGoBack: enableBack,
            canGoForward: enableForward,
        };
    };

    /**
     * Listeners
     */

    onUserActivityUpdate = (listener: (userIsActive: boolean, idleTime: number, isSystemEvent: boolean) => void) => {
        if (window.desktopAPI?.onUserActivityUpdate) {
            return window.desktopAPI.onUserActivityUpdate(listener);
        }

        const legacyListener = ({userIsActive, manual}: {userIsActive: boolean; manual: boolean}) => listener(userIsActive, 0, manual);
        this.addPostMessageListener('user-activity-update', legacyListener);

        return () => this.removePostMessageListener('user-activity-update', legacyListener);
    };

    onNotificationClicked = (listener: (channelId: string, teamId: string, url: string) => void) => {
        if (window.desktopAPI?.onNotificationClicked) {
            return window.desktopAPI.onNotificationClicked(listener);
        }

        const legacyListener = ({channel, teamId, url}: {channel: {id: string}; teamId: string; url: string}) => listener(channel.id, teamId, url);
        this.addPostMessageListener('notification-clicked', legacyListener);

        return () => this.removePostMessageListener('notification-clicked', legacyListener);
    };

    onBrowserHistoryPush = (listener: (pathName: string) => void) => {
        if (window.desktopAPI?.onBrowserHistoryPush) {
            return window.desktopAPI.onBrowserHistoryPush(listener);
        }

        const legacyListener = ({pathName}: {pathName: string}) => listener(pathName);
        this.addPostMessageListener('browser-history-push-return', legacyListener);

        return () => this.removePostMessageListener('browser-history-push-return', legacyListener);
    };

    onBrowserHistoryStatusUpdated = (listener: (enableBack: boolean, enableForward: boolean) => void) => {
        if (window.desktopAPI?.onBrowserHistoryStatusUpdated) {
            return window.desktopAPI.onBrowserHistoryStatusUpdated(listener);
        }

        const legacyListener = ({enableBack, enableForward}: {enableBack: boolean; enableForward: boolean}) => listener(enableBack, enableForward);
        this.addPostMessageListener('history-button-return', legacyListener);

        return () => this.removePostMessageListener('history-button-return', legacyListener);
    };

    /**
     * One-ways
     */

    dispatchNotification = (
        title: string,
        body: string,
        channelId: string,
        teamId: string,
        silent: boolean,
        soundName: string,
        url: string,
    ) => {
        if (window.desktopAPI?.sendNotification) {
            window.desktopAPI.sendNotification(title, body, channelId, teamId, url, silent, soundName);
            return;
        }

        // get the desktop app to trigger the notification
        window.postMessage(
            {
                type: 'dispatch-notification',
                message: {
                    title,
                    body,
                    channel: {id: channelId},
                    teamId,
                    silent,
                    data: {soundName},
                    url,
                },
            },
            window.location.origin,
        );
    };

    doBrowserHistoryPush = (path: string) => {
        if (window.desktopAPI?.sendBrowserHistoryPush) {
            window.desktopAPI.sendBrowserHistoryPush(path);
            return;
        }

        window.postMessage(
            {
                type: 'browser-history-push',
                message: {path},
            },
            window.location.origin,
        );
    };

    updateUnreadsAndMentions = (isUnread: boolean, mentionCount: number) =>
        window.desktopAPI?.setUnreadsAndMentions && window.desktopAPI.setUnreadsAndMentions(isUnread, mentionCount);
    setSessionExpired = (expired: boolean) => window.desktopAPI?.setSessionExpired && window.desktopAPI.setSessionExpired(expired);

    /*********************************************************************
     * Helper functions for legacy code
     * Remove all of this once we have no use for message passing anymore
     *********************************************************************/

    /**
     * @deprecated
     */
    private postMessageListener = ({origin, data: {type, message}}: {origin: string; data: {type: string; message: unknown}}) => {
        if (origin !== window.location.origin) {
            return;
        }

        const listeners = this.postMessageListeners?.get(type);
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
    private addPostMessageListener = (channel: string, listener: (message: any) => void) => {
        if (this.postMessageListeners?.has(channel)) {
            this.postMessageListeners.set(channel, this.postMessageListeners.get(channel)!.add(listener));
        } else {
            this.postMessageListeners?.set(channel, new Set([listener]));
        }
    };

    /**
     * @deprecated
     */
    private removePostMessageListener = (channel: string, listener: (message: any) => void) => {
        const set = this.postMessageListeners?.get(channel);
        set?.delete(listener);
        if (set?.size) {
            this.postMessageListeners?.set(channel, set);
        } else {
            this.postMessageListeners?.delete(channel);
        }
    };

    /**
     * @deprecated
     */
    private invokeWithMessaging = <T, T2>(
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

const DesktopApp = new DesktopAppAPI();
export default DesktopApp;
