// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime, Interval} from 'luxon';

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

const SiteURLPendingPrefix = 'pending_';
export const isConfirmed = (rc: RemoteCluster) => Boolean(rc.site_url && !rc.site_url.startsWith(SiteURLPendingPrefix));
export const isConnected = (rc: RemoteCluster) => Interval.before(DateTime.now(), {minutes: 5}).contains(DateTime.fromMillis(rc.last_ping_at));
