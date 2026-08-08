// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AuthorType, ReleaseStage} from '@mattermost/types/marketplace';
import type {MarketplacePlugin} from '@mattermost/types/marketplace';

import {
    getPlugins,
    getListing,
    getInstalledListing,
    getPlugin,
    getFilter,
    getInstalling,
    getError,
} from 'selectors/views/marketplace';

import type {GlobalState} from 'types/store';

describe('marketplace', () => {
    const samplePlugin: MarketplacePlugin = {
        homepage_url: 'https://github.com/mattermost/mattermost-plugin-nps',
        download_url: 'https://github.com/mattermost/mattermost-plugin-nps/releases/download/v1.0.3/com.mattermost.nps-1.0.3.tar.gz',
        author_type: AuthorType.Mattermost,
        release_stage: ReleaseStage.Production,
        enterprise: false,
        manifest: {
            id: 'com.mattermost.nps',
            name: 'User Satisfaction Surveys',
            description: 'This plugin sends quarterly user satisfaction surveys to gather feedback and help improve Mattermost',
            version: '1.0.3',
            min_server_version: '5.14.0',
        },
        installed_version: '',
    };

    const sampleInstalledPlugin: MarketplacePlugin = {
        homepage_url: 'https://github.com/mattermost/mattermost-test',
        download_url: 'https://github.com/mattermost/mattermost-test/releases/download/v1.0.3/com.mattermost.nps-1.0.3.tar.gz',
        author_type: AuthorType.Mattermost,
        release_stage: ReleaseStage.Production,
        enterprise: false,
        manifest: {
            id: 'com.mattermost.test',
            name: 'Test',
            description: 'This plugin is to test',
            version: '1.0.3',
            min_server_version: '5.14.0',
        },
        installed_version: '1.0.3',
    };

    const state = {
        views: {
            marketplace: {
                plugins: [samplePlugin, sampleInstalledPlugin],
                installing: {'com.mattermost.nps': true},
                errors: {'com.mattermost.test': 'An error occurred'},
                filter: 'existing',
            },
        },
    } as unknown as GlobalState;

    it('getListing should return all plugins', () => {
        expect(getListing(state)).toEqual([samplePlugin, sampleInstalledPlugin]);
    });

    it('getInstalledListing should return only installed plugins', () => {
        expect(getInstalledListing(state)).toEqual([sampleInstalledPlugin]);
    });

    it('getPlugins should return all plugins', () => {
        expect(getPlugins(state)).toEqual([samplePlugin, sampleInstalledPlugin]);
    });

    describe('getPlugin', () => {
        it('should return samplePlugin', () => {
            expect(getPlugin(state, 'com.mattermost.nps')).toEqual(samplePlugin);
        });

        it('should return sampleInstalledPlugin', () => {
            expect(getPlugin(state, 'com.mattermost.test')).toEqual(sampleInstalledPlugin);
        });

        it('should return undefined for unknown plugin', () => {
            expect(getPlugin(state, 'unknown')).toBeUndefined();
        });
    });

    it('getFilter should return the active filter', () => {
        expect(getFilter(state)).toEqual('existing');
    });

    describe('getInstalling', () => {
        it('should return true for samplePlugin', () => {
            expect(getInstalling(state, 'com.mattermost.nps')).toBe(true);
        });

        it('should return false for sampleInstalledPlugin', () => {
            expect(getInstalling(state, 'com.mattermost.test')).toBe(false);
        });

        it('should return false for unknown plugin', () => {
            expect(getInstalling(state, 'unknown')).toBe(false);
        });
    });

    describe('getError', () => {
        it('should return undefined for samplePlugin', () => {
            expect(getError(state, 'com.mattermost.nps')).toBeUndefined();
        });

        it('should return error value for sampleInstalledPlugin', () => {
            expect(getError(state, 'com.mattermost.test')).toBe('An error occurred');
        });

        it('should return undefined for unknown plugin', () => {
            expect(getError(state, 'unknown')).toBeUndefined();
        });
    });
});
