// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';

import {
    getRemoteClusterConnectionStatus,
    isRemoteClusterConfirmed,
    isRemoteClusterConnected,
    type RemoteConnectionInfo,
} from './remote_cluster_connection';

describe('remote_cluster_connection', () => {
    describe('isRemoteClusterConfirmed', () => {
        it('returns true when site_url is set and does not start with pending_', () => {
            expect(isRemoteClusterConfirmed({site_url: 'https://example.com', last_ping_at: 0})).toBe(true);
            expect(isRemoteClusterConfirmed({site_url: 'https://siteurl', last_ping_at: 0})).toBe(true);
        });

        it('returns false when site_url is missing', () => {
            expect(isRemoteClusterConfirmed({last_ping_at: 0} as RemoteConnectionInfo)).toBe(false);
        });

        it('returns false when site_url starts with pending_', () => {
            expect(isRemoteClusterConfirmed({site_url: 'pending_https://siteurl', last_ping_at: 0})).toBe(false);
            expect(isRemoteClusterConfirmed({site_url: 'pending_', last_ping_at: 0})).toBe(false);
        });

        it('returns false when site_url is empty', () => {
            expect(isRemoteClusterConfirmed({site_url: '', last_ping_at: 0})).toBe(false);
        });
    });

    describe('isRemoteClusterConnected', () => {
        it('returns false when last_ping_at is 0', () => {
            expect(isRemoteClusterConnected({last_ping_at: 0})).toBe(false);
        });

        it('returns true when last_ping_at is within the last 5 minutes', () => {
            const twoMinutesAgo = DateTime.now().minus({minutes: 2}).toMillis();
            expect(isRemoteClusterConnected({last_ping_at: twoMinutesAgo})).toBe(true);
        });

        it('returns false when last_ping_at is older than 5 minutes', () => {
            const tenMinutesAgo = DateTime.now().minus({minutes: 10}).toMillis();
            expect(isRemoteClusterConnected({last_ping_at: tenMinutesAgo})).toBe(false);
        });

        it('returns true when last_ping_at is very recent', () => {
            // Add a small delay to ensure the test is not flaky
            const now = DateTime.now().minus({milliseconds: 100}).toMillis();
            expect(isRemoteClusterConnected({last_ping_at: now})).toBe(true);
        });
    });

    describe('getRemoteClusterConnectionStatus', () => {
        it('returns connection_pending when site_url is missing', () => {
            expect(getRemoteClusterConnectionStatus({last_ping_at: DateTime.now().toMillis()} as RemoteConnectionInfo)).toBe('connection_pending');
        });

        it('returns connection_pending when site_url starts with pending_', () => {
            expect(getRemoteClusterConnectionStatus({
                site_url: 'pending_https://siteurl',
                last_ping_at: DateTime.now().toMillis(),
            })).toBe('connection_pending');
        });

        it('returns connected when confirmed and last_ping_at is recent', () => {
            const twoMinutesAgo = DateTime.now().minus({minutes: 2}).toMillis();
            expect(getRemoteClusterConnectionStatus({
                site_url: 'https://example.com',
                last_ping_at: twoMinutesAgo,
            })).toBe('connected');
        });

        it('returns offline when confirmed but last_ping_at is old', () => {
            const tenMinutesAgo = DateTime.now().minus({minutes: 10}).toMillis();
            expect(getRemoteClusterConnectionStatus({
                site_url: 'https://example.com',
                last_ping_at: tenMinutesAgo,
            })).toBe('offline');
        });

        it('returns offline when confirmed but last_ping_at is 0', () => {
            expect(getRemoteClusterConnectionStatus({
                site_url: 'https://example.com',
                last_ping_at: 0,
            })).toBe('offline');
        });
    });
});
