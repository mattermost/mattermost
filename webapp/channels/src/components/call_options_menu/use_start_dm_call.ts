// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch, useStore} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {createDirectChannel} from 'mattermost-redux/actions/channels';
import {getMyCurrentChannelMembership} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

/**
 * Returns a function that starts a call with the user through the first call plugin,
 * creating the DM channel first if it doesn't exist yet.
 */
export default function useStartDMCall(userId: string, dmChannel?: Channel | null) {
    const dispatch = useDispatch();
    const store = useStore<GlobalState>();

    return useCallback(async () => {
        let channel = dmChannel;
        if (!channel) {
            const {data} = await dispatch(createDirectChannel(getCurrentUserId(store.getState()), userId));
            channel = data;
        }
        if (!channel) {
            return;
        }

        const state = store.getState();
        state.plugins.components.CallButton?.[0]?.action?.(channel, getMyCurrentChannelMembership(state));
    }, [dispatch, store, dmChannel, userId]);
}
