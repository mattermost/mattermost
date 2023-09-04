// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import type {MarketplacePlugin} from '@mattermost/types/marketplace';
import {AuthorType, ReleaseStage} from '@mattermost/types/marketplace';

import type {ActionFunc} from 'mattermost-redux/types/actions';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import MarketplaceModal from './marketplace_modal';
import type {OpenedFromType} from './marketplace_modal';
import WebMarketplaceBanner from './web_marketplace_banner';

let mockState: GlobalState;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: jest.fn(() => (action: ActionFunc) => action),
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

    const defaultProps = {
        openedFrom: 'actions_menu' as OpenedFromType,
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
            },
        } as unknown as GlobalState;
    });

    test('should render default', () => {
        const wrapper = shallow(
            <MarketplaceModal {...defaultProps}/>,
        );

        expect(wrapper.shallow()).toMatchSnapshot();
    });

    test('should render with no plugins available', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementationOnce(() => [false, setState]);

        const wrapper = shallow(
            <MarketplaceModal {...defaultProps}/>,
        );

        wrapper.update();

        expect(wrapper.shallow()).toMatchSnapshot();
    });

    test('should render with plugins available', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementationOnce(() => [false, setState]);

        mockState.views.marketplace.plugins = [
            samplePlugin,
        ];

        const wrapper = shallow(
            <MarketplaceModal {...defaultProps}/>,
        );

        wrapper.update();

        expect(wrapper.shallow()).toMatchSnapshot();
    });

    test('should render with plugins installed', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementationOnce(() => [false, setState]);

        mockState.views.marketplace.plugins = [
            samplePlugin,
            sampleInstalledPlugin,
        ];

        const wrapper = shallow(
            <MarketplaceModal {...defaultProps}/>,
        );

        wrapper.update();

        expect(wrapper.shallow()).toMatchSnapshot();
    });

    test('should render with error banner', () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementation(() => [true, setState]);

        const wrapper = shallow(
            <MarketplaceModal {...defaultProps}/>,
        );

        wrapper.update();

        expect(wrapper.shallow()).toMatchSnapshot();
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

        const wrapper = shallow(
            <MarketplaceModal {...defaultProps}/>,
        );

        wrapper.update();
        const content = wrapper.shallow();

        expect(content.exists('#searchMarketplaceTextbox')).toBe(false);
        expect(content.exists(WebMarketplaceBanner)).toBe(true);

        expect(content).toMatchSnapshot();
    });

    test("doesn't show web marketplace banner in FeatureFlags.StreamlinedMarketplace for Cloud", () => {
        const setState = jest.fn();
        const useStateSpy = jest.spyOn(React, 'useState');
        useStateSpy.mockImplementation(() => [true, setState]);

        (mockState.entities.general.config as any).FeatureFlagStreamlinedMarketplace = 'true';
        mockState.entities.general.license.Cloud = 'true';

        const wrapper = shallow(
            <MarketplaceModal {...defaultProps}/>,
        );

        wrapper.update();
        const content = wrapper.shallow();

        expect(content.exists(WebMarketplaceBanner)).toBe(false);

        expect(content).toMatchSnapshot();
    });
});
