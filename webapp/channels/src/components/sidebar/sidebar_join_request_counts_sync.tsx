// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {countPendingChannelJoinRequests} from 'mattermost-redux/actions/channels';
import {canManageChannelJoinRequests, getMyChannels} from 'mattermost-redux/selectors/entities/channels';
import {isDiscoverableChannelsEnabled} from 'mattermost-redux/selectors/entities/general';
import {createIdsSelector} from 'mattermost-redux/utils/helpers';

import type {GlobalState} from 'types/store';

// createIdsSelector keeps the returned id array referentially stable while the
// contents are unchanged, so useSelector does not warn or rerender needlessly.
const selectManageableDiscoverableChannelIds = createIdsSelector(
    'selectManageableDiscoverableChannelIds',
    (state: GlobalState) => state,
    (state: GlobalState): string[] => {
        if (!isDiscoverableChannelsEnabled(state)) {
            return [];
        }

        return getMyChannels(state).
            filter((channel) => canManageChannelJoinRequests(state, channel)).
            map((channel) => channel.id);
    },
);

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
