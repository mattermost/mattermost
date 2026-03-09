// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MarketplacePlugin} from '@mattermost/types/marketplace';
import {AuthorType, ReleaseStage} from '@mattermost/types/marketplace';

import {renderWithContext} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import MarketplaceModal from './marketplace_modal';

let mockState: GlobalState;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: jest.fn(() => (action: unknown) => action),
}));

describe('components/marketplace/', () => {
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

    beforeEach(() => {
        mockState = {
            views: {
                modals: {
                    modalState: {
                        [ModalIdentifiers.PLUGIN_MARKETPLACE]: {
                            open: true,
                        },
                    },
                },
                marketplace: {
                    plugins: [],
                    apps: [],
                },
            },
            entities: {
                general: {
                    firstAdminCompleteSetup: false,
                    config: {
                        FeatureFlagStreamlinedMarketplace: 'false',
                    },
                    license: {
                        Cloud: 'false',
                    },
                },
                admin: {
                    pluginStatuses: {},
                },
                users: {
                    currentUserId: 'user1',
                    profiles: {
                        user1: {
                            id: 'user1',
                            roles: 'system_admin',
                        },
                    },
                },
                preferences: {
                    myPreferences: {},
                },
            },
        } as unknown as GlobalState;
    });

    test('should render default', () => {
        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should render with no plugins available', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementationOnce(() => [false, setState]);

        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should render with plugins available', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementationOnce(() => [false, setState]);

        mockState.views.marketplace.plugins = [
            samplePlugin,
        ];

        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should render with plugins installed', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementationOnce(() => [false, setState]);

        mockState.views.marketplace.plugins = [
            samplePlugin,
            sampleInstalledPlugin,
        ];

        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
        );

        expect(baseElement).toMatchSnapshot();
    });

    test('should render with error banner', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementation(() => [true, setState]);

        // Suppress expected errors from useState mock affecting all child components
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const {baseElement} = renderWithContext(
                <MarketplaceModal/>,
            );

            expect(baseElement).toMatchSnapshot();
        } finally {
            errorSpy.mockRestore();
        }
    });

    test('hides search, shows web marketplace banner in FeatureFlags.StreamlinedMarketplace', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementation(() => [true, setState]);

        mockState.views.marketplace.plugins = [
            samplePlugin,
            sampleInstalledPlugin,
        ];

        (mockState.entities.general.config as any).FeatureFlagStreamlinedMarketplace = 'true';

        // Suppress expected errors from useState mock affecting all child components
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const {baseElement} = renderWithContext(
                <MarketplaceModal/>,
            );

            expect(baseElement.querySelector('#searchMarketplaceTextbox')).not.toBeInTheDocument();
            expect(document.querySelector('.WebMarketplaceBanner')).toBeInTheDocument();

            expect(baseElement).toMatchSnapshot();
        } finally {
            errorSpy.mockRestore();
        }
    });

    test("doesn't show web marketplace banner in FeatureFlags.StreamlinedMarketplace for Cloud", () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementation(() => [true, setState]);

        (mockState.entities.general.config as any).FeatureFlagStreamlinedMarketplace = 'true';
        mockState.entities.general.license.Cloud = 'true';

        // Suppress expected errors from useState mock affecting all child components
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const {baseElement} = renderWithContext(
                <MarketplaceModal/>,
            );

            expect(document.querySelector('.WebMarketplaceBanner')).not.toBeInTheDocument();

            expect(baseElement).toMatchSnapshot();
        } finally {
            errorSpy.mockRestore();
        }
    });
});
