// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {MarketplacePlugin} from '@mattermost/types/marketplace';
import {AuthorType, ReleaseStage} from '@mattermost/types/marketplace';

import {fetchListing} from 'actions/marketplace';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import MarketplaceModal from './marketplace_modal';

jest.mock('actions/marketplace', () => ({
    ...jest.requireActual('actions/marketplace') as typeof import('actions/marketplace'),
    fetchListing: jest.fn(),
}));

const mockedFetchListing = jest.mocked(fetchListing);

function mockFetchListingSuccess() {
    mockedFetchListing.mockImplementation(() => async () => ({data: []}));
}

function mockFetchListingError() {
    mockedFetchListing.mockImplementation(() => async () => ({error: new Error('failed to fetch listing')}));
}

async function waitForListingToLoad() {
    await waitFor(() => {
        expect(screen.queryByTestId('loading-screen')).not.toBeInTheDocument();
    });
}

describe('components/marketplace/', () => {
    let mockState: GlobalState;

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
        mockFetchListingSuccess();

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
                    config: {},
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

    test('should render default', async () => {
        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
            mockState,
        );

        expect(screen.getByTestId('loading-screen')).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();

        await waitForListingToLoad();
    });

    test('should render with no plugins available', async () => {
        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
            mockState,
        );

        await waitForListingToLoad();

        expect(baseElement).toMatchSnapshot();
    });

    test('should render with plugins available', async () => {
        mockState.views.marketplace.plugins = [
            samplePlugin,
        ];

        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
            mockState,
        );

        await waitForListingToLoad();

        expect(baseElement).toMatchSnapshot();
    });

    test('should render with plugins installed', async () => {
        mockState.views.marketplace.plugins = [
            samplePlugin,
            sampleInstalledPlugin,
        ];

        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
            mockState,
        );

        await waitForListingToLoad();

        expect(baseElement).toMatchSnapshot();
    });

    test('should render with error banner', async () => {
        mockFetchListingError();

        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
            mockState,
        );

        await waitForListingToLoad();

        expect(screen.getByText('System Console', {exact: false})).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test('hides search and shows web marketplace banner', async () => {
        mockState.views.marketplace.plugins = [
            samplePlugin,
            sampleInstalledPlugin,
        ];

        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
            mockState,
        );

        await waitForListingToLoad();

        expect(baseElement.querySelector('#searchMarketplaceTextbox')).not.toBeInTheDocument();
        expect(document.querySelector('.WebMarketplaceBanner')).toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });

    test("doesn't show web marketplace banner for Cloud", async () => {
        mockState.entities.general.license.Cloud = 'true';

        const {baseElement} = renderWithContext(
            <MarketplaceModal/>,
            mockState,
        );

        await waitForListingToLoad();

        expect(document.querySelector('.WebMarketplaceBanner')).not.toBeInTheDocument();

        expect(baseElement).toMatchSnapshot();
    });
});
