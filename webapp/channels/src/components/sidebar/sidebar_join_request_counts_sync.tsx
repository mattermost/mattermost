// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {countPendingChannelJoinRequests} from 'mattermost-redux/actions/channels';
import {getManageableDiscoverableChannelIds} from 'mattermost-redux/selectors/entities/channels';

// Caps how many count requests are in flight at once so a user who manages many
// discoverable channels doesn't fire an unbounded burst on mount.
const MAX_CONCURRENT_COUNT_REQUESTS = 5;

// Prefetches pending join-request counts for every discoverable private channel
// the current user can manage so LHS dots appear without opening each channel.
export default function SidebarJoinRequestCountsSync() {
    const dispatch = useDispatch();
    const channelIds = useSelector(getManageableDiscoverableChannelIds);
    const channelIdsKey = channelIds.join(',');

    useEffect(() => {
        if (!channelIdsKey) {
            return undefined;
        }

        const ids = channelIdsKey.split(',');
        let cancelled = false;

        const prefetchCounts = async () => {
            for (let i = 0; i < ids.length; i += MAX_CONCURRENT_COUNT_REQUESTS) {
                if (cancelled) {
                    return;
                }
                const batch = ids.slice(i, i + MAX_CONCURRENT_COUNT_REQUESTS);

                // Intentionally sequential: each batch must settle before the
                // next so no more than MAX_CONCURRENT_COUNT_REQUESTS are in
                // flight at once.
                // eslint-disable-next-line no-await-in-loop
                await Promise.all(batch.map((channelId) => dispatch(countPendingChannelJoinRequests(channelId))));
            }
        };

        prefetchCounts();

        return () => {
            cancelled = true;
        };
    }, [channelIdsKey, dispatch]);

    return null;
}
