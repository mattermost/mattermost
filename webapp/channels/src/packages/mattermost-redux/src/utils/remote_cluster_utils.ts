// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime, Interval} from 'luxon';

import type {RemoteClusterInfo} from '@mattermost/types/shared_channels';

const SiteURLPendingPrefix = 'pending_';
export const isConfirmed = (rc: RemoteClusterInfo) => Boolean(rc.site_url && !rc.site_url.startsWith(SiteURLPendingPrefix));
export const isConnected = (rc: RemoteClusterInfo) => {
    // Check if last_ping_at is recent enough (within last 5 minutes) to consider the connection active
    if (!rc.last_ping_at) {
        return false;
    }

    return Interval.before(DateTime.now(), {minutes: 5}).contains(DateTime.fromMillis(rc.last_ping_at));
};
