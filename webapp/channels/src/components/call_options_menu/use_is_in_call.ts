// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getSessionsInCalls} from 'selectors/calls';

import type {GlobalState} from 'types/store';
import type {CallButtonAction} from 'types/store/plugins';

// hasStartCallMenu reports whether the call plugin supports the Start call menu. Older plugins don't pass
// any of its actions and keep the call button they had before.
export function hasStartCallMenu(callButton?: CallButtonAction): boolean {
    return Boolean(callButton?.copyCallLinkAction || callButton?.callSettingsAction);
}

// isInCall prefers the plugin's own answer, which covers starting and ringing before anyone has joined.
// Without it, a call counts once someone has joined it.
export function isInCall(state: GlobalState, callButton: CallButtonAction | undefined, channelId: string | undefined): boolean {
    if (!channelId) {
        return false;
    }
    if (callButton?.isInCall) {
        return callButton.isInCall(state, channelId);
    }
    return Object.keys(getSessionsInCalls(state)[channelId] ?? {}).length > 0;
}

export default function useIsInCall(callButton: CallButtonAction | undefined, channelId: string | undefined, enabled = true): boolean {
    return useSelector((state: GlobalState) => enabled && isInCall(state, callButton, channelId));
}
