// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import * as reactRedux from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import MenuGroup from 'components/widgets/menu/menu_group';

import {TestHelper} from 'utils/test_helper';

import ProductMenuList from './product_menu_list';
import type {Props as ProductMenuListProps} from './product_menu_list';

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useSelector: jest.fn(),
}));

describe('components/global/product_switcher_menu', () => {
    let useSelectorMock: jest.Mock;

    const getMenuWrapper = (props: ProductMenuListProps) => {
        const wrapper = shallow(<ProductMenuList {...props}/>);
        return wrapper.find(MenuGroup).shallow();
    };

    const user = TestHelper.getUserMock({
        id: 'test-user-id',
        username: 'username',
    });

    const defaultProps: ProductMenuListProps = {
        isMobile: false,
        teamId: '',
        teamName: '',
        siteName: '',
        currentUser: user,
        appDownloadLink: 'test–link',
        isMessaging: true,
        enableCommands: false,
        enableIncomingWebhooks: false,
        enableOAuthServiceProvider: false,
        enableOutgoingWebhooks: false,
        canManageSystemBots: false,
        canManageIntegrations: true,
        enablePluginMarketplace: false,
        showVisitSystemConsoleTour: false,
        isStarterFree: false,
        isFreeTrial: false,
        onClick: () => jest.fn,
        handleVisitConsoleClick: () => jest.fn,
        enableCustomUserGroups: false,
        actions: {
            openModal: jest.fn(),
            getPrevTrialLicense: jest.fn(),
        },
    };

    beforeEach(() => {
        useSelectorMock = reactRedux.useSelector as jest.Mock;
        useSelectorMock.mockReturnValue(true);
    });

    test('should match snapshot with id', () => {
        const props = {...defaultProps, id: 'product-switcher-menu-test'};
        const wrapper = shallow(<ProductMenuList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should not render if the user is not logged in', () => {
        const props = {
            ...defaultProps,
            currentUser: undefined as unknown as UserProfile,
        };
        const wrapper = shallow(<ProductMenuList {...props}/>);
        expect(wrapper.type()).toEqual(null);
    });

    test('should match snapshot with most of the thing enabled', () => {
        const props = {
            ...defaultProps,
            enableCommands: true,
            enableIncomingWebhooks: true,
            enableOAuthServiceProvider: true,
            enableOutgoingWebhooks: true,
            canManageSystemBots: true,
            canManageIntegrations: true,
            enablePluginMarketplace: true,
        };
        const wrapper = shallow(<ProductMenuList {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match userGroups snapshot with cloud free', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: false,
            isStarterFree: true,
            isFreeTrial: false,
        };
        const wrapper = shallow(<ProductMenuList {...props}/>);
        expect(wrapper.find('#userGroups')).toMatchSnapshot();
    });

    test('should match userGroups snapshot with cloud free trial', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: false,
            isStarterFree: false,
            isFreeTrial: true,
        };
        const wrapper = shallow(<ProductMenuList {...props}/>);
        expect(wrapper.find('#userGroups')).toMatchSnapshot();
    });

    test('should match userGroups snapshot with EnableCustomGroups config', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: true,
            isStarterFree: false,
            isFreeTrial: false,
        };
        const wrapper = shallow(<ProductMenuList {...props}/>);
        expect(wrapper.find('#userGroups')).toMatchSnapshot();
    });

    test('user groups button is disabled for free', () => {
        const props = {
            ...defaultProps,
            enableCustomUserGroups: true,
            isStarterFree: true,
            isFreeTrial: false,
        };
        const wrapper = getMenuWrapper(props);
        expect(wrapper.find('#userGroups').prop('disabled')).toBe(true);
    });

    test('should hide RestrictedIndicator if user is not admin', () => {
        useSelectorMock.mockReturnValueOnce(false);

        const props = {
            ...defaultProps,
            isStarterFree: true,
        };

        const wrapper = shallow(<ProductMenuList {...props}/>);

        expect(wrapper.find('RestrictedIndicator').exists()).toBe(false);
    });

    describe('should show integrations', () => {
        it('when incoming webhooks enabled', () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
            };
            const wrapper = shallow(<ProductMenuList {...props}/>);
            expect(wrapper.find('#integrations').prop('show')).toBe(true);
        });

        it('when outgoing webhooks enabled', () => {
            const props = {
                ...defaultProps,
                enableOutgoingWebhooks: true,
            };
            const wrapper = shallow(<ProductMenuList {...props}/>);
            expect(wrapper.find('#integrations').prop('show')).toBe(true);
        });

        it('when slash commands enabled', () => {
            const props = {
                ...defaultProps,
                enableCommands: true,
            };
            const wrapper = getMenuWrapper(props);
            expect(wrapper.find('#integrations').prop('show')).toBe(true);
        });

        it('when oauth providers enabled', () => {
            const props = {
                ...defaultProps,
                enableOAuthServiceProvider: true,
            };
            const wrapper = getMenuWrapper(props);
            expect(wrapper.find('#integrations').prop('show')).toBe(true);
        });

        it('when can manage system bots', () => {
            const props = {
                ...defaultProps,
                canManageSystemBots: true,
            };
            const wrapper = getMenuWrapper(props);
            expect(wrapper.find('#integrations').prop('show')).toBe(true);
        });

        it('unless cannot manage integrations', () => {
            const props = {
                ...defaultProps,
                canManageIntegrations: false,
                enableCommands: true,
            };
            const wrapper = getMenuWrapper(props);
            expect(wrapper.find('#integrations').prop('show')).toBe(false);
        });

        it('should show integrations modal', () => {
            const props = {
                ...defaultProps,
                enableIncomingWebhooks: true,
            };
            const wrapper = getMenuWrapper(props);
            wrapper.find('#integrations').simulate('click');
            expect(wrapper).toMatchSnapshot();
        });
    });
});
