// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {countPendingChannelJoinRequests} from 'mattermost-redux/actions/channels';
import {canManageChannelJoinRequests, getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import type {GlobalState} from 'types/store';

// Keeps the pending join-request count fresh for the active channel so the
// header badge and LHS dot stay in sync with WS events.
export default function ChannelJoinRequestCountSync() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const canManageJoinRequests = useSelector((state: GlobalState) => canManageChannelJoinRequests(state, channel));

    useEffect(() => {
        if (canManageJoinRequests && channel) {
            dispatch(countPendingChannelJoinRequests(channel.id));
        }
    }, [canManageJoinRequests, channel?.id, dispatch]);

    return null;
}
