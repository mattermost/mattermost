// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import UserGuideDropdown from './user_guide_dropdown';

describe('components/channel_header/components/UserGuideDropdown', () => {
    const baseProps = {
        helpLink: 'helpLink',
        isMobileView: false,
        reportAProblemLink: 'reportAProblemLink',
        enableAskCommunityLink: 'true',
        location: {
            pathname: '/team/channel/channelId',
        },
        teamUrl: '/team',
        actions: {
            openModal: jest.fn(),
        },
        pluginMenuItems: [],
        isFirstAdmin: false,
        onboardingFlowEnabled: false,
    };

    test('should match snapshot', () => {
        const wrapper = shallowWithIntl(
            <UserGuideDropdown {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot for false of enableAskCommunityLink', () => {
        const props = {
            ...baseProps,
            enableAskCommunityLink: 'false',
        };

        const wrapper = shallowWithIntl(
            <UserGuideDropdown {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when have plugin menu items', () => {
        const props = {
            ...baseProps,
            pluginMenuItems: [{id: 'testId', pluginId: 'testPluginId', text: 'Test Item', action: () => {}},
            ],
        };

        const wrapper = shallowWithIntl(
            <UserGuideDropdown {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('Should set state buttonActive on toggle of MenuWrapper', () => {
        const wrapper = shallowWithIntl(
            <UserGuideDropdown {...baseProps}/>,
        );

        expect(wrapper.state('buttonActive')).toBe(false);
        wrapper.find(MenuWrapper).prop('onToggle')!(true);
        expect(wrapper.state('buttonActive')).toBe(true);
    });

    test('Should set state buttonActive on toggle of MenuWrapper', () => {
        const wrapper = shallowWithIntl(
            <UserGuideDropdown {...baseProps}/>,
        );

        wrapper.find(Menu.ItemAction).find('#keyboardShortcuts').prop('onClick')!({preventDefault: jest.fn()} as unknown as React.MouseEvent);
        expect(baseProps.actions.openModal).toHaveBeenCalled();
    });

    test('should have plugin menu items appended to the menu', () => {
        const props = {
            ...baseProps,
            pluginMenuItems: [{id: 'testId', pluginId: 'testPluginId', text: 'Test Plugin Item', action: () => {}},
            ],
        };

        const wrapper = shallowWithIntl(
            <UserGuideDropdown {...props}/>,
        );

        // pluginMenuItems are appended, so our entry must be the last one.
        const pluginMenuItem = wrapper.find(Menu.ItemAction).last();
        expect(pluginMenuItem.prop('text')).toEqual('Test Plugin Item');
    });

    test('should only render Report a Problem link when its value is non-empty', () => {
        const wrapper = shallowWithIntl(
            <UserGuideDropdown {...baseProps}/>,
        );

        expect(wrapper.find('#reportAProblemLink').exists()).toBe(true);

        wrapper.setProps({
            reportAProblemLink: '',
        });

        expect(wrapper.find('#reportAProblemLink').exists()).toBe(false);
    });
});
