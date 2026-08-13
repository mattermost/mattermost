// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime, Interval} from 'luxon';

const SITE_URL_PENDING_PREFIX = 'pending_';
const CONNECTED_PING_THRESHOLD_MINUTES = 5;

export type RemoteConnectionInfo = {
    site_url?: string;
    last_ping_at: number;
};

export function isRemoteClusterConfirmed(rc: RemoteConnectionInfo): boolean {
    return Boolean(rc.site_url && !rc.site_url.startsWith(SITE_URL_PENDING_PREFIX));
}

export function isRemoteClusterConnected(rc: RemoteConnectionInfo): boolean {
    if (!rc.last_ping_at) {
        return false;
    }
    return Interval.before(DateTime.now(), {minutes: CONNECTED_PING_THRESHOLD_MINUTES}).contains(DateTime.fromMillis(rc.last_ping_at));
}

export type RemoteConnectionStatus = 'connection_pending' | 'connected' | 'offline';

export function getRemoteClusterConnectionStatus(rc: RemoteConnectionInfo): RemoteConnectionStatus {
    if (!isRemoteClusterConfirmed(rc)) {
        return 'connection_pending';
    }
    return isRemoteClusterConnected(rc) ? 'connected' : 'offline';
}
