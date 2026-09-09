// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostType} from '@mattermost/types/posts';

import {isMobile} from 'components/widgets/menu/is_mobile_view_hack';

import {fireEvent, renderWithContext} from 'tests/react_testing_utils';
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

// MenuWrapperAnimation reads the mobile-view flag from the global store; keep it in sync with the
// isMobileView prop so the deprecated widget renders the menu directly (as it does on real devices)
// instead of wrapping the portal in a CSSTransition.
jest.mock('components/widgets/menu/is_mobile_view_hack', () => ({
    isMobile: jest.fn(() => false),
}));

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
        isMobileView: false,
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

    afterEach(() => {
        jest.mocked(isMobile).mockReturnValue(false);
    });

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

    test('mobile view - renders the menu in a portal on the document body so it is not trapped in the scroll container', () => {
        jest.mocked(isMobile).mockReturnValue(true);

        const {container} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                isMobileView={true}
                pluginMenuItems={dropdownMenuActions}
                canOpenMarketplace={true}
            />,
        );

        const portal = document.body.querySelector('.post-actions-menu-mobile');
        expect(portal).not.toBeNull();

        // The menu is portaled onto the body, outside the component's own container.
        expect(portal?.parentElement).toBe(document.body);
        expect(container.querySelector('.post-actions-menu-mobile')).toBeNull();

        // The menu and its items render inside the portal.
        expect(portal).toHaveTextContent('App Marketplace');
        expect(portal?.querySelector('.Menu')).not.toBeNull();
    });

    test('mobile view - items in the portaled menu are reachable and invoke their action with the post id', () => {
        jest.mocked(isMobile).mockReturnValue(true);

        const action = jest.fn();
        const pluginMenuItems: PostDropdownMenuAction[] = [{
            id: 'the_component_id',
            pluginId: 'playbooks',
            text: 'Run playbook',
            action,
            filter: jest.fn(() => true),
        }];

        renderWithContext(
            <ActionsMenu
                {...baseProps}
                isMobileView={true}
                pluginMenuItems={pluginMenuItems}
                canOpenMarketplace={true}
            />,
        );

        const portal = document.body.querySelector('.post-actions-menu-mobile');
        const item = [...(portal?.querySelectorAll('button, a') ?? [])].
            find((el) => el.textContent === 'Run playbook');
        expect(item).toBeDefined();

        fireEvent.click(item as Element);

        expect(action).toHaveBeenCalledWith('post_id_1');
    });

    test('desktop view - renders the menu inline without a portal', () => {
        const {container} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                isMobileView={false}
                pluginMenuItems={dropdownMenuActions}
                canOpenMarketplace={true}
            />,
        );

        expect(document.body.querySelector('.post-actions-menu-mobile')).toBeNull();
        expect(container.querySelector('.Menu')).not.toBeNull();
        expect(container).toHaveTextContent('App Marketplace');
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
