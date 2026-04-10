// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostType} from '@mattermost/types/posts';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {PostDropdownMenuAction, PostDropdownMenuItemComponent} from 'types/store/plugins';

import ActionsMenu from './actions_menu';
import type {Props} from './actions_menu';

// Mock the MUI-based popover to avoid anchorEl PropType warning when rendering with isMenuOpen=true
jest.mock('./popover', () => {
    return function MockPopover({children, isOpen}: {children: React.ReactNode; isOpen: boolean}) {
        return isOpen ? <div data-testid='mock-popover'>{children}</div> : null;
    };
});

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        isMobile: jest.fn(() => false),
    };
});

const dropdownMenuActions: PostDropdownMenuAction[] = [
    {
        id: 'the_component_id',
        pluginId: 'playbooks',
        text: 'Some text',
        action: jest.fn(),
        filter: jest.fn(() => true),
    },
];

const dropdownComponents: PostDropdownMenuItemComponent[] = [
    {
        id: 'the_component_id',
        pluginId: 'playbooks',
        text: 'Some text',
        component: () => null,
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
        pluginMenuItemComponents: [],
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
        const {container, rerender} = renderWithContext(
            <ActionsMenu {...baseProps}/>,
        );
        expect(container.querySelector('#divider_post_post_id_1_marketplace')).toBeNull();

        rerender(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownMenuActions}
                canOpenMarketplace={true}
            />,
        );
        expect(container.querySelector('#divider_post_post_id_1_marketplace')).not.toBeNull();
    });

    test('has actions - marketplace enabled and user has SYSCONSOLE_WRITE_PLUGINS - should show actions and app marketplace', () => {
        const {container} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownMenuActions}
                canOpenMarketplace={true}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('has actions - marketplace disabled or user not having SYSCONSOLE_WRITE_PLUGINS - should not show actions and app marketplace', () => {
        const {container} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownMenuActions}
                canOpenMarketplace={false}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('no actions - sysadmin - menu should show visit marketplace', () => {
        const {container} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                canOpenMarketplace={true}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('no actions - end user - menu should not be visible to end user', () => {
        const {container} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                isSysAdmin={false}
            />,
        );

        // menu should be empty
        expect(container).toMatchSnapshot();
    });

    test('sysadmin - should have divider when pluggable menu item exists', () => {
        const {container, rerender} = renderWithContext(
            <ActionsMenu {...baseProps}/>,
        );
        expect(container.querySelector('#divider_post_post_id_1_marketplace')).toBeNull();

        rerender(
            <ActionsMenu
                {...baseProps}
                pluginMenuItemComponents={dropdownComponents}
                canOpenMarketplace={true}
            />,
        );
        expect(container.querySelector('#divider_post_post_id_1_marketplace')).not.toBeNull();
    });

    test('end user - should not have divider when pluggable menu item exists', () => {
        const {container, rerender} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                isSysAdmin={false}
            />,
        );
        expect(container.querySelector('#divider_post_post_id_1_marketplace')).toBeNull();

        rerender(
            <ActionsMenu
                {...baseProps}
                isSysAdmin={false}
                pluginMenuItemComponents={dropdownComponents}
            />,
        );
        expect(container.querySelector('#divider_post_post_id_1_marketplace')).toBeNull();
    });
});
