// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useHistory} from 'react-router-dom';

import {getHistory} from 'utils/browser_history';
import {isDesktopApp} from 'utils/user_agent';

const POPOUT_WIDTH = 800;
const POPOUT_HEIGHT_OFFSET = 100;
const CLOSE_POLL_INTERVAL = 200;
const CLOSE_POLL_MAX_TRIES = 10;

export function useBrowserPopout() {
    const history = useHistory();
    useEffect(() => {
        if (!isDesktopApp()) {
            const navigateListener = history.block((blockState) => {
                window.opener.postMessage({
                    channel: '_navigate',
                    args: [blockState.pathname],
                }, window.location.origin);
                return false;
            });
            const closeListener = () => {
                window.opener.postMessage({
                    channel: '_close',
                    args: [],
                }, window.location.origin);
            };

            window.addEventListener('beforeunload', closeListener);
            return () => {
                navigateListener();
                window.removeEventListener('beforeunload', closeListener);
            };
        }

        return () => {};
    }, [history]);
}

export class BrowserPopouts {
    private popoutWindows: Map<Window, string>;
    private listeners: Map<string, Set<(channel: string, ...args: any[]) => void>>;
    private closeListeners: Map<string, Set<() => void>>;

    constructor() {
        this.popoutWindows = new Map();
        this.listeners = new Map();
        this.closeListeners = new Map();

        window.addEventListener('message', (event) => {
            const popout = event.source as Window;
            if (!this.popoutWindows.has(popout)) {
                return;
            }

            if (event.origin !== window.location.origin) {
                return;
            }

            const target = this.popoutWindows.get(popout);
            if (!target) {
                return;
            }

            switch (event.data.channel) {
            case '_navigate':
                window.focus();
                getHistory().push(event.data.args[0]);
                return;
            case '_close': {
                // Unfortunately, there is no way to know if the window is
                // closed other than checking the beforeunload event
                // so we need to poll until it is closed or we reach the max tries,
                // to ensure the close listener is called at the right time and that
                // the listeners are not deleted prematurely.
                let tries = 0;
                const checkInterval = setInterval(() => {
                    tries++;
                    if (popout.closed) {
                        clearInterval(checkInterval);
                        this.closeListeners.get(target)?.forEach((listener) => {
                            listener();
                        });
                        this.listeners.delete(target);
                        this.closeListeners.delete(target);
                        this.popoutWindows.delete(popout);
                    }
                    if (tries >= CLOSE_POLL_MAX_TRIES) {
                        clearInterval(checkInterval);
                    }
                }, CLOSE_POLL_INTERVAL);
                return;
            }
            }

            this.listeners.get(target)?.forEach((listener) => {
                listener(event.data.channel, ...event.data.args);
            });
        });
    }

    setupBrowserPopout = (path: string) => {
        const target = path.replace(/\//g, '-').replace('-_popout-', '');
        const popoutWindow = window.open(
            path,
            target,
            [
                'popup=true',
                `left=${(window.screenX + window.outerWidth) - POPOUT_WIDTH}`,
                `top=${window.screenY + POPOUT_HEIGHT_OFFSET}`,
                `width=${POPOUT_WIDTH}`,
                `height=${window.innerHeight - (POPOUT_HEIGHT_OFFSET * 2)}`,
            ].join(','),
        );

        if (!popoutWindow) {
            return {};
        }

        this.popoutWindows.set(popoutWindow, target);
        this.listeners.set(target, new Set());
        this.closeListeners.set(target, new Set());

        return {
            send: (channel: string, ...args: any[]) => {
                popoutWindow.postMessage({
                    channel,
                    args,
                }, window.location.origin);
            },
            message: (listener: (channel: string, ...args: any[]) => void) => {
                this.listeners.get(target)?.add(listener);
                return () => {
                    this.listeners.get(target)?.delete(listener);
                };
            },
            closed: (listener: () => void) => {
                this.closeListeners.get(target)?.add(listener);
                return () => {
                    this.closeListeners.get(target)?.delete(listener);
                };
            },
        };
    };

    sendToParent = (channel: string, ...args: any[]) => {
        window.opener.postMessage({
            channel,
            args,
        }, window.location.origin);
    };

    onMessageFromParent = (listener: (channel: string, ...args: any[]) => void) => {
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            if (event.source !== window.opener) {
                return;
            }
            listener(event.data.channel, ...event.data.args);
        });
    };
}

const browserPopouts = new BrowserPopouts();
export default browserPopouts;
