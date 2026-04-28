// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PopoutListeners} from './popout_windows';

export const POPOUT_FOCUSED = '_popout_focused';
export const POPOUT_BLURRED = '_popout_blurred';

export type FocusedPopoutInfo = {channelId: string; threadId?: string};

let focusedPopout: FocusedPopoutInfo | null = null;

export function getFocusedPopoutInfo() {
    return focusedPopout;
}

export function registerPopoutFocusListeners(listeners: Partial<PopoutListeners>) {
    listeners.onMessageFromPopout?.((channel: string, ...args: unknown[]) => {
        switch (channel) {
        case POPOUT_FOCUSED:
            focusedPopout = {
                channelId: args[0] as string,
                threadId: args[1] as string | undefined,
            };
            break;
        case POPOUT_BLURRED:
            focusedPopout = null;
            break;
        }
    });
}
