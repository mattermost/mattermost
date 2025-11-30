// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {AuthorType, ReleaseStage} from '@mattermost/types/marketplace';
import type {MarketplacePlugin} from '@mattermost/types/marketplace';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import MarketplaceList, {ITEMS_PER_PAGE} from './marketplace_list';

describe('components/marketplace/marketplace_list', () => {
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

    // State needed for connected MarketplaceItemPlugin components
    const baseState = {
        entities: {
            general: {
                config: {
                    IsDefaultMarketplace: 'true',
                },
            },
            admin: {
                pluginStatuses: {},
            },
        },
        views: {
            marketplace: {
                plugins: [],
                apps: [],
                installing: {},
                errors: {},
            },
        },
    };

    it('should render default', () => {
        const {container} = renderWithContext(
            <MarketplaceList
                listing={[]}
                page={0}
                noResultsMessage=''
            />,
            baseState,
        );

        expect(container).toMatchSnapshot();
    });

    it('should render page with ITEMS_PER_PAGE plugins', () => {
        // Create unique plugins with different IDs to avoid duplicate key warning
        const plugins = Array.from({length: 17}, (_, i) => ({
            ...samplePlugin,
            manifest: {
                ...samplePlugin.manifest,
                id: `com.mattermost.plugin-${i}`,
                name: `Plugin ${i}`,
            },
        }));

        renderWithContext(
            <MarketplaceList
                listing={plugins}
                page={0}
                noResultsMessage=''
            />,
            baseState,
        );

        // Should render exactly ITEMS_PER_PAGE items
        const items = document.querySelectorAll('.more-modal__row');
        expect(items).toHaveLength(ITEMS_PER_PAGE);
    });

    it('should render no results', () => {
        renderWithContext(
            <MarketplaceList
                listing={[]}
                page={0}
                noResultsMessage='No plugins available'
                noResultsAction={{
                    label: 'action',
                    onClick: vi.fn(),
                }}
            />,
            baseState,
        );

        expect(document.querySelector('.icon__plugin')).toBeInTheDocument();
        expect(screen.getByText('No plugins available')).toBeInTheDocument();
        expect(screen.getByText('action')).toBeInTheDocument();
    });
});
