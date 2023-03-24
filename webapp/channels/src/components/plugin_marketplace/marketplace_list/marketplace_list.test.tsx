// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {AuthorType, MarketplacePlugin, ReleaseStage} from '@mattermost/types/marketplace';

import MarketplaceItem from '../marketplace_item/marketplace_item_plugin';

import MarketplaceList from './marketplace_list';
import NavigationRow from './navigation_row';

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

    it('should render with multiple plugins', () => {
        const wrapper = shallow<MarketplaceList>(
            <MarketplaceList
                listing={[
                    samplePlugin, samplePlugin, samplePlugin, samplePlugin, samplePlugin,
                    samplePlugin, samplePlugin, samplePlugin, samplePlugin, samplePlugin,
                    samplePlugin, samplePlugin, samplePlugin, samplePlugin, samplePlugin,
                    samplePlugin, samplePlugin,
                ]}
            />,
        );
        expect(wrapper).toMatchSnapshot();

        expect(wrapper.state().page).toEqual(0);
        expect(wrapper.find(MarketplaceItem)).toHaveLength(15);
        expect(wrapper.find(NavigationRow)).toHaveLength(1);
        expect(wrapper.find(NavigationRow).props().page).toEqual(0);
        expect(wrapper.find(NavigationRow).props().total).toEqual(17);
        expect(wrapper.find(NavigationRow).props().maximumPerPage).toEqual(15);
    });

    it('should set page to 0 when list of plugins changed', () => {
        const wrapper = shallow<MarketplaceList>(
            <MarketplaceList
                listing={[samplePlugin, samplePlugin]}
            />,
        );

        wrapper.setState({page: 10});
        wrapper.setProps({listing: [samplePlugin]});

        expect(wrapper.state().page).toEqual(0);
    });
});
