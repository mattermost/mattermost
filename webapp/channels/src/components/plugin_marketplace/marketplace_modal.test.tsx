// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {AuthorType, MarketplacePlugin, ReleaseStage} from '@mattermost/types/marketplace';
import type {PluginStatusRedux} from '@mattermost/types/plugins';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import MarketplaceModal, {AllListing, InstalledListing, MarketplaceModalProps} from './marketplace_modal';

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
    };
});

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

    describe('AllListing', () => {
        it('should render with no plugins', () => {
            const wrapper = shallow(
                <AllListing listing={[]}/>,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('should render with one plugin', () => {
            const wrapper = shallow(
                <AllListing listing={[samplePlugin]}/>,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('should render with plugins', () => {
            const wrapper = shallow(
                <AllListing listing={[samplePlugin, sampleInstalledPlugin]}/>,
            );
            expect(wrapper).toMatchSnapshot();
        });
    });

    describe('InstalledPlugins', () => {
        const baseProps = {
            changeTab: jest.fn(),
        };

        it('should render with no plugins', () => {
            const wrapper = shallow(
                <InstalledListing
                    {...baseProps}
                    installedItems={[]}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('should render with one plugin', () => {
            const wrapper = shallow(
                <InstalledListing
                    {...baseProps}
                    installedItems={[sampleInstalledPlugin]}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });

        it('should render with multiple plugins', () => {
            const wrapper = shallow(
                <InstalledListing
                    {...baseProps}
                    installedItems={[sampleInstalledPlugin, sampleInstalledPlugin]}
                />,
            );
            expect(wrapper).toMatchSnapshot();
        });
    });

    describe('MarketplaceModal', () => {
        const baseProps: MarketplaceModalProps = {
            show: true,
            listing: [samplePlugin],
            installedListing: [],
            pluginStatuses: {},
            siteURL: 'http://example.com',
            firstAdminVisitMarketplaceStatus: false,
            actions: {
                closeModal: jest.fn(),
                fetchListing: jest.fn(() => {
                    return Promise.resolve({});
                }),
                filterListing: jest.fn(() => {
                    return Promise.resolve({});
                }),
                setFirstAdminVisitMarketplaceStatus: jest.fn(),
                getPluginStatuses: jest.fn(),
            },
        };

        test('should render with no plugins installed', () => {
            const wrapper = shallow<MarketplaceModal>(
                <MarketplaceModal {...baseProps}/>,
            );
            expect(wrapper).toMatchSnapshot();
        });

        test('should render with plugins installed', () => {
            const props = {
                ...baseProps,
                plugins: [
                    ...baseProps.listing,
                    sampleInstalledPlugin,
                ],
                installedListing: [
                    sampleInstalledPlugin,
                ],
            };

            const wrapper = shallow<MarketplaceModal>(
                <MarketplaceModal {...props}/>,
            );

            expect(wrapper).toMatchSnapshot();
        });

        test('should fetch plugins when plugin status is changed', () => {
            const fetchListing = baseProps.actions.fetchListing;
            const wrapper = shallow<MarketplaceModal>(<MarketplaceModal {...baseProps}/>);

            expect(fetchListing).toBeCalledTimes(1);
            wrapper.setProps({...baseProps});
            expect(fetchListing).toBeCalledTimes(1);

            const status = {
                id: 'test',
            } as PluginStatusRedux;
            wrapper.setProps({...baseProps, pluginStatuses: {test: status}});
            expect(fetchListing).toBeCalledTimes(2);
        });

        test('should render with error banner', () => {
            const wrapper = shallow<MarketplaceModal>(
                <MarketplaceModal {...baseProps}/>,
            );

            wrapper.setState({serverError: {name: 'some.error', message: 'Error test'}});

            expect(wrapper).toMatchSnapshot();
        });

        test('Should call for track event when searching', () => {
            const wrapper = shallow<MarketplaceModal>(
                <MarketplaceModal {...baseProps}/>,
            );

            wrapper.setState({filter: 'nps'});
            wrapper.instance().doSearch();

            expect(trackEvent).toHaveBeenCalledWith('plugins', 'ui_marketplace_opened');
            expect(trackEvent).toHaveBeenCalledWith('plugins', 'ui_marketplace_search', {filter: 'nps'});
        });
    });
});
