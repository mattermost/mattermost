// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AuthorType, ReleaseStage} from '@mattermost/types/marketplace';
import type {MarketplaceApp, MarketplacePlugin} from '@mattermost/types/marketplace';

import {
    getPlugins,
    getListing,
    getInstalledListing,
    getApp,
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

    const sampleApp: MarketplaceApp = {
        installed: false,
        author_type: AuthorType.Mattermost,
        release_stage: ReleaseStage.Production,
        enterprise: false,
        manifest: {
            app_id: 'some.id',
            display_name: 'Some App',
        },
    };

    const sampleInstalledApp: MarketplaceApp = {
        installed: true,
        author_type: AuthorType.Mattermost,
        release_stage: ReleaseStage.Production,
        enterprise: false,
        manifest: {
            app_id: 'some.other.id',
            display_name: 'Some other App',
        },
    };

    const state = {
        views: {
            marketplace: {
                plugins: [samplePlugin, sampleInstalledPlugin],
                apps: [sampleApp, sampleInstalledApp],
                installing: {'com.mattermost.nps': true},
                errors: {'com.mattermost.test': 'An error occurred'},
                filter: 'existing',
            },
        },
    } as unknown as GlobalState;

    test('getListing should return all plugins and apps', () => {
        expect(getListing(state)).toEqual([samplePlugin, sampleInstalledPlugin, sampleApp, sampleInstalledApp]);
    });

    test('getInstalledListing should return only installed plugins and apps', () => {
        expect(getInstalledListing(state)).toEqual([sampleInstalledPlugin, sampleInstalledApp]);
    });

    test('getPlugins should return all plugins', () => {
        expect(getPlugins(state)).toEqual([samplePlugin, sampleInstalledPlugin]);
    });

    describe('getPlugin', () => {
        test('should return samplePlugin', () => {
            expect(getPlugin(state, 'com.mattermost.nps')).toEqual(samplePlugin);
        });

        test('should return sampleInstalledPlugin', () => {
            expect(getPlugin(state, 'com.mattermost.test')).toEqual(sampleInstalledPlugin);
        });

        test('should return undefined for unknown plugin', () => {
            expect(getPlugin(state, 'unknown')).toBeUndefined();
        });
    });

    describe('getApp', () => {
        test('should return sampleApp', () => {
            expect(getApp(state, 'some.id')).toEqual(sampleApp);
        });

        test('should return sampleInstalledApp', () => {
            expect(getApp(state, 'some.other.id')).toEqual(sampleInstalledApp);
        });

        test('should return undefined for unknown app', () => {
            expect(getApp(state, 'unknown')).toBeUndefined();
        });
    });

    test('getFilter should return the active filter', () => {
        expect(getFilter(state)).toEqual('existing');
    });

    describe('getInstalling', () => {
        test('should return true for samplePlugin', () => {
            expect(getInstalling(state, 'com.mattermost.nps')).toBe(true);
        });

        test('should return false for sampleInstalledPlugin', () => {
            expect(getInstalling(state, 'com.mattermost.test')).toBe(false);
        });

        test('should return false for unknown plugin', () => {
            expect(getInstalling(state, 'unknown')).toBe(false);
        });
    });

    describe('getError', () => {
        test('should return undefined for samplePlugin', () => {
            expect(getError(state, 'com.mattermost.nps')).toBeUndefined();
        });

        test('should return error value for sampleInstalledPlugin', () => {
            expect(getError(state, 'com.mattermost.test')).toBe('An error occurred');
        });

        test('should return undefined for unknown plugin', () => {
            expect(getError(state, 'unknown')).toBeUndefined();
        });
    });
});
