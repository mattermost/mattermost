// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostType} from '@mattermost/types/posts';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import type {PluginComponent} from 'types/store/plugins';

import ActionsMenu, {PLUGGABLE_COMPONENT} from './actions_menu';
import type {Props} from './actions_menu';

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        isMobile: jest.fn(() => false),
    };
});

const dropdownComponents: PluginComponent[] = [
    {
        id: 'the_component_id',
        pluginId: 'playbooks',
        action: jest.fn(),
    },
];

describe('components/actions_menu/ActionsMenu', () => {
    const baseProps: Omit<Props, 'intl'> = {
        appBindings: [],
        appsEnabled: false,
        teamId: 'team_id_1',
        handleDropdownOpened: jest.fn(),
        isMenuOpen: true,
        isSysAdmin: true,
        pluginMenuItems: [],
        post: TestHelper.getPostMock({id: 'post_id_1', is_pinned: false, type: '' as PostType}),
        components: {},
        location: 'center',
        canOpenMarketplace: false,
        actions: {
            openModal: jest.fn(),
            openAppsModal: jest.fn(),
            handleBindingClick: jest.fn(),
            postEphemeralCallResponseForPost: jest.fn(),
            fetchBindings: jest.fn(),
        },
    };

    test('sysadmin - should have divider when plugin menu item exists', () => {
        const wrapper = shallowWithIntl(
            <ActionsMenu {...baseProps}/>,
        );
        expect(wrapper.find('#divider_post_post_id_1_marketplace').exists()).toBe(false);

        wrapper.setProps({
            pluginMenuItems: dropdownComponents,
            canOpenMarketplace: true,
        });
        expect(wrapper.find('#divider_post_post_id_1_marketplace').exists()).toBe(true);
    });

    test('has actions - marketplace enabled and user has SYSCONSOLE_WRITE_PLUGINS - should show actions and app marketplace', () => {
        const wrapper = shallowWithIntl(
            <ActionsMenu {...baseProps}/>,
        );
        wrapper.setProps({
            pluginMenuItems: dropdownComponents,
            canOpenMarketplace: true,
        });
        expect(wrapper).toMatchSnapshot();
    });

    test('has actions - marketplace disabled or user not having SYSCONSOLE_WRITE_PLUGINS - should not show actions and app marketplace', () => {
        const wrapper = shallowWithIntl(
            <ActionsMenu {...baseProps}/>,
        );
        wrapper.setProps({
            pluginMenuItems: dropdownComponents,
            canOpenMarketplace: false,
        });
        expect(wrapper).toMatchSnapshot();
    });

    test('no actions - sysadmin - menu should show visit marketplace', () => {
        const wrapper = shallowWithIntl(
            <ActionsMenu {...baseProps}/>,
        );

        wrapper.setProps({
            canOpenMarketplace: true,
        });

        expect(wrapper).toMatchSnapshot();
    });

    test('no actions - end user - menu should not be visible to end user', () => {
        const wrapper = shallowWithIntl(
            <ActionsMenu {...baseProps}/>,
        );
        wrapper.setProps({
            isSysAdmin: false,
        });

        // menu should be empty
        expect(wrapper.debug()).toMatchSnapshot();
    });

    test('sysadmin - should have divider when pluggable menu item exists', () => {
        const wrapper = shallowWithIntl(
            <ActionsMenu {...baseProps}/>,
        );
        expect(wrapper.find('#divider_post_post_id_1_marketplace').exists()).toBe(false);

        wrapper.setProps({
            components: {
                [PLUGGABLE_COMPONENT]: dropdownComponents,
            },
            canOpenMarketplace: true,
        });
        expect(wrapper.find('#divider_post_post_id_1_marketplace').exists()).toBe(true);
    });

    test('end user - should not have divider when pluggable menu item exists', () => {
        const wrapper = shallowWithIntl(
            <ActionsMenu {...baseProps}/>,
        );
        wrapper.setProps({
            isSysAdmin: false,
        });
        expect(wrapper.find('#divider_post_post_id_1_marketplace').exists()).toBe(false);

        wrapper.setProps({
            components: {
                [PLUGGABLE_COMPONENT]: dropdownComponents,
            },
        });
        expect(wrapper.find('#divider_post_post_id_1_marketplace').exists()).toBe(false);
    });
});
