// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {AuthorType, ReleaseStage} from '@mattermost/types/marketplace';

import MarketplaceList, {ITEMS_PER_PAGE} from './marketplace_list';

import MarketplaceItem from '../marketplace_item/marketplace_item_plugin';

import type {MarketplacePlugin} from '@mattermost/types/marketplace';

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
        const wrapper = shallow(
            <MarketplaceList
                listing={[]}
                page={0}
                noResultsMessage=''
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should render page with ITEMS_PER_PAGE plugins', () => {
        const wrapper = shallow(
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

        expect(wrapper.find(MarketplaceItem)).toHaveLength(ITEMS_PER_PAGE);
    });

    it('should render no results', () => {
        const wrapper = shallow(
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

        expect(wrapper.find('.icon__plugin').length).toEqual(1);
        expect(wrapper.find('.no_plugins__message').length).toEqual(1);
        expect(wrapper.find('.no_plugins__action').length).toEqual(1);
    });
});
