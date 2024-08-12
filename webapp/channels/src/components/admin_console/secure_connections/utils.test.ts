// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {RemoteCluster} from '@mattermost/types/remote_clusters';

import {isConnected, isPending} from './utils';

describe('isPending', () => {
    it('should return true', () => {
        const pending = isPending({site_url: 'pending_https://siteurl'} as RemoteCluster);
        expect(pending).toBe(true);
    });

    it('should return false', () => {
        const pending = isPending({site_url: 'https://siteurl'} as RemoteCluster);
        expect(pending).toBe(false);
    });
});

describe('isConnected', () => {
    it('should return true', () => {
        const pending = isConnected({site_url: 'https://siteurl'} as RemoteCluster);
        expect(pending).toBe(true);
    });

    it('should return false', () => {
        const pending = isPending({site_url: 'pending_https://siteurl'} as RemoteCluster);
        expect(pending).toBe(false);
    });
});
