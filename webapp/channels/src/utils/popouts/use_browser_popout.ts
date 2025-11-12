// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useHistory} from 'react-router-dom';

import {isDesktopApp} from 'utils/user_agent';

import {NAVIGATE_CHANNEL, CLOSE_CHANNEL} from './browser_popouts';

export function useBrowserPopout() {
    const history = useHistory();
    useEffect(() => {
        if (!isDesktopApp()) {
            const unblockHistory = history.block((blockState) => {
                window.opener.postMessage({
                    channel: NAVIGATE_CHANNEL,
                    args: [blockState.pathname],
                }, window.location.origin);
                return false;
            });
            const closeListener = () => {
                window.opener.postMessage({
                    channel: CLOSE_CHANNEL,
                    args: [],
                }, window.location.origin);
            };

            window.addEventListener('beforeunload', closeListener);
            return () => {
                unblockHistory();
                window.removeEventListener('beforeunload', closeListener);
            };
        }

        return () => {};
    }, [history]);
}

export function sendToParent(channel: string, ...args: any[]) {
    window.opener.postMessage({
        channel,
        args,
    }, window.location.origin);
}

export function onMessageFromParent(listener: (channel: string, ...args: any[]) => void) {
    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) {
            return;
        }
        if (event.source !== window.opener) {
            return;
        }
        listener(event.data.channel, ...event.data.args);
    });
}
