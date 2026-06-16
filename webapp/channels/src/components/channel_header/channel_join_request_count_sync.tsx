// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {countPendingChannelJoinRequests} from 'mattermost-redux/actions/channels';
import {Permissions} from 'mattermost-redux/constants';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {isDiscoverableChannelsEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

// Keeps the pending join-request count fresh for the active channel so the
// header badge and LHS dot stay in sync with WS events.
export default function ChannelJoinRequestCountSync() {
    const dispatch = useDispatch();
    const channel = useSelector(getCurrentChannel);
    const teamId = useSelector(getCurrentTeamId);
    const discoverableFeatureEnabled = useSelector(isDiscoverableChannelsEnabled);
    const canManageJoinRequests = useSelector((state: GlobalState) => {
        if (!channel || !teamId || !discoverableFeatureEnabled) {
            return false;
        }
        if (channel.type !== Constants.PRIVATE_CHANNEL || !channel.discoverable) {
            return false;
        }
        return haveIChannelPermission(
            state,
            teamId,
            channel.id,
            Permissions.MANAGE_CHANNEL_JOIN_REQUESTS,
        );
    });

    useEffect(() => {
        if (canManageJoinRequests && channel) {
            dispatch(countPendingChannelJoinRequests(channel.id));
        }
    }, [canManageJoinRequests, channel?.id, dispatch]);

    return null;
}
