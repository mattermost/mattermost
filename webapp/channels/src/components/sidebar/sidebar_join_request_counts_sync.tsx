// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {countPendingChannelJoinRequests} from 'mattermost-redux/actions/channels';
import {getManageableDiscoverableChannelIds} from 'mattermost-redux/selectors/entities/channels';

// Prefetches pending join-request counts for every discoverable private channel
// the current user can manage so LHS dots appear without opening each channel.
export default function SidebarJoinRequestCountsSync() {
    const dispatch = useDispatch();
    const channelIds = useSelector(getManageableDiscoverableChannelIds);
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
