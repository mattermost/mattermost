// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import {
    getCreateLocation,
    getEditLocation,
    isConfirmed,
    isErrorState,
    isPendingState,
} from './utils';

describe('isConfirmed', () => {
    it('should return true', () => {
        const confirmed = isConfirmed({site_url: 'https://siteurl'} as RemoteCluster);
        expect(confirmed).toBe(true);
    });

    it('should return false', () => {
        const confirmed = isConfirmed({site_url: 'pending_https://siteurl'} as RemoteCluster);
        expect(confirmed).toBe(false);
    });
});

describe('getEditLocation', () => {
    it('returns the edit path for the given remote cluster and carries it as state', () => {
        const rc = {remote_id: 'abc123', display_name: 'Acme'} as RemoteCluster;

        const location = getEditLocation(rc);

        expect(location).toEqual({
            pathname: '/admin_console/site_config/secure_connections/abc123',
            state: rc,
        });
    });
});

describe('getCreateLocation', () => {
    it('returns the create path', () => {
        const location = getCreateLocation();

        expect(location).toEqual({
            pathname: '/admin_console/site_config/secure_connections/create',
        });
    });
});

describe('isPendingState', () => {
    it('returns true only when loading state is exactly true', () => {
        expect(isPendingState(true)).toBe(true);
    });

    it('returns false when loading state is false', () => {
        expect(isPendingState(false)).toBe(false);
    });

    it('returns false when loading state is an Error', () => {
        const err = new Error('boom');
        expect(isPendingState(err)).toBe(false);
    });
});

describe('isErrorState', () => {
    it('returns true for an Error instance', () => {
        const err = new Error('boom');
        expect(isErrorState(err)).toBe(true);
    });

    it('returns false for boolean true (still loading)', () => {
        expect(isErrorState(true)).toBe(false);
    });

    it('returns false for boolean false (idle)', () => {
        expect(isErrorState(false)).toBe(false);
    });
});
