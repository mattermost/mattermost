// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {AuthorType, ReleaseStage} from '@mattermost/types/marketplace';
import type {MarketplacePlugin} from '@mattermost/types/marketplace';

import {renderWithContext} from 'tests/react_testing_utils';

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

    it('should render default', () => {
        const {container} = renderWithContext(
            <MarketplaceList
                listing={[]}
                page={0}
                noResultsMessage=''
            />,
        );

        expect(container).toMatchSnapshot();
    });

    it('should render page with ITEMS_PER_PAGE plugins', () => {
        // Suppress expected duplicate key warnings from using same plugin object multiple times
        const originalError = console.error;
        console.error = jest.fn();

        const {container} = renderWithContext(
            <MarketplaceList
                listing={[
                    samplePlugin, samplePlugin, samplePlugin, samplePlugin, samplePlugin,
                    samplePlugin, samplePlugin, samplePlugin, samplePlugin, samplePlugin,
                    samplePlugin, samplePlugin, samplePlugin, samplePlugin, samplePlugin,
                    samplePlugin, samplePlugin,
                ]}
                page={0}
                noResultsMessage=''
            />,
        );

        // With RTL, verify items are rendered in the list
        const listItems = container.querySelectorAll('.more-modal__list > *');
        expect(listItems.length).toBe(ITEMS_PER_PAGE);

        console.error = originalError;
    });

    it('should render no results', () => {
        const {container} = renderWithContext(
            <MarketplaceList
                listing={[]}
                page={0}
                noResultsMessage='No plugins available'
                noResultsAction={{
                    label: 'action',
                    onClick: jest.fn(),
                }}
            />,
        );

        expect(container.querySelectorAll('.icon__plugin').length).toEqual(1);
        expect(container.querySelectorAll('.no_plugins__message').length).toEqual(1);
        expect(container.querySelectorAll('.no_plugins__action').length).toEqual(1);
    });
});
