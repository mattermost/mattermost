// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {countPendingChannelJoinRequests} from 'mattermost-redux/actions/channels';
import {Permissions} from 'mattermost-redux/constants';
import {getMyChannels} from 'mattermost-redux/selectors/entities/channels';
import {isDiscoverableChannelsEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

function selectManageableDiscoverableChannelIds(state: GlobalState): string[] {
    if (!isDiscoverableChannelsEnabled(state)) {
        return [];
    }

    const teamId = getCurrentTeamId(state);
    if (!teamId) {
        return [];
    }

    return getMyChannels(state).
        filter(
            (channel) =>
                channel.type === Constants.PRIVATE_CHANNEL &&
                channel.discoverable === true &&
                haveIChannelPermission(
                    state,
                    teamId,
                    channel.id,
                    Permissions.MANAGE_CHANNEL_JOIN_REQUESTS,
                ),
        ).
        map((channel) => channel.id);
}

// Prefetches pending join-request counts for every discoverable private channel
// the current user can manage so LHS dots appear without opening each channel.
export default function SidebarJoinRequestCountsSync() {
    const dispatch = useDispatch();
    const channelIds = useSelector(selectManageableDiscoverableChannelIds);
    const channelIdsKey = channelIds.join(',');

    useEffect(() => {
        if (!channelIdsKey) {
            return;
        }

        for (const channelId of channelIdsKey.split(',')) {
            dispatch(countPendingChannelJoinRequests(channelId));
        }
    }, [channelIdsKey, dispatch]);

    return null;
}
