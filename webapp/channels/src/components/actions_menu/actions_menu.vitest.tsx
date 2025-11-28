// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import type {PostType} from '@mattermost/types/posts';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {PostDropdownMenuAction} from 'types/store/plugins';

import ActionsMenu from './actions_menu';
import type {Props} from './actions_menu';

vi.mock('utils/utils', async (importOriginal) => {
    const original = await importOriginal<typeof import('utils/utils')>();
    return {
        ...original,
        isMobile: vi.fn(() => false),
    };
});

const dropdownComponents: PostDropdownMenuAction[] = [
    {
        id: 'the_component_id',
        pluginId: 'playbooks',
        text: 'Some text',
        action: vi.fn(),
        filter: () => true,
    },
];

describe('components/actions_menu/ActionsMenu', () => {
    const baseProps: Omit<Props, 'intl'> = {
        appBindings: [],
        appsEnabled: false,
        teamId: 'team_id_1',
        handleDropdownOpened: vi.fn(),
        isMenuOpen: true,
        isSysAdmin: true,
        pluginMenuItems: [],
        post: TestHelper.getPostMock({id: 'post_id_1', is_pinned: false, type: '' as PostType}),
        pluginMenuItemComponents: [],
        location: 'center',
        canOpenMarketplace: false,
        actions: {
            openModal: vi.fn(),
            openAppsModal: vi.fn(),
            handleBindingClick: vi.fn(),
            postEphemeralCallResponseForPost: vi.fn(),
            fetchBindings: vi.fn(),
        },
    };

    test('sysadmin - should have divider when plugin menu item exists', () => {
        // First render without plugin items and marketplace - this needs plugin items
        // to render the MenuWrapper, so pass them from the start
        const {rerender} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownComponents}
                canOpenMarketplace={false}
            />,
        );

        // No marketplace divider without canOpenMarketplace
        expect(document.getElementById('divider_post_post_id_1_marketplace')).not.toBeInTheDocument();

        // Rerender with marketplace enabled
        rerender(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownComponents}
                canOpenMarketplace={true}
            />,
        );
        expect(document.getElementById('divider_post_post_id_1_marketplace')).toBeInTheDocument();
    });

    test('has actions - marketplace enabled and user has SYSCONSOLE_WRITE_PLUGINS - should show actions and app marketplace', () => {
        renderWithContext(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownComponents}
                canOpenMarketplace={true}
            />,
        );

        // Should show plugin menu item text
        expect(screen.getByText('Some text')).toBeInTheDocument();

        // Should show App Marketplace
        expect(screen.getByText('App Marketplace')).toBeInTheDocument();

        // Should have divider
        expect(document.getElementById('divider_post_post_id_1_marketplace')).toBeInTheDocument();
    });

    test('has actions - marketplace disabled or user not having SYSCONSOLE_WRITE_PLUGINS - should not show actions and app marketplace', () => {
        renderWithContext(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownComponents}
                canOpenMarketplace={false}
            />,
        );

        // Should show plugin menu item text
        expect(screen.getByText('Some text')).toBeInTheDocument();

        // Should NOT show App Marketplace
        expect(screen.queryByText('App Marketplace')).not.toBeInTheDocument();

        // Should NOT have divider
        expect(document.getElementById('divider_post_post_id_1_marketplace')).not.toBeInTheDocument();
    });

    test('no actions - sysadmin - menu should show visit marketplace', () => {
        // When there are no plugin items but sysadmin can open marketplace,
        // it shows the ActionsMenuEmptyPopover.
        // The component renders a button and an empty popover when opened.
        // However, with isMenuOpen=false initially, no popover is shown.
        const {container} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                canOpenMarketplace={true}
                isMenuOpen={false}
            />,
        );

        // Should render the button for sysadmin
        expect(container.querySelector('[id="center_actions_button_post_id_1"]')).toBeInTheDocument();
    });

    test('no actions - end user - menu should not be visible to end user', () => {
        const {container} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                isSysAdmin={false}
            />,
        );

        // menu should be empty for end user with no actions
        expect(container.firstChild).toBeNull();
    });

    test('sysadmin - should have divider when pluggable menu item exists', () => {
        // First render with pluggable items but no marketplace
        const {rerender} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownComponents}
                canOpenMarketplace={false}
            />,
        );
        expect(document.getElementById('divider_post_post_id_1_marketplace')).not.toBeInTheDocument();

        // Rerender with marketplace enabled
        rerender(
            <ActionsMenu
                {...baseProps}
                pluginMenuItems={dropdownComponents}
                canOpenMarketplace={true}
            />,
        );
        expect(document.getElementById('divider_post_post_id_1_marketplace')).toBeInTheDocument();
    });

    test('end user - should not have divider when pluggable menu item exists', () => {
        // Render as end user with pluggable items
        const {rerender} = renderWithContext(
            <ActionsMenu
                {...baseProps}
                isSysAdmin={false}
                pluginMenuItems={dropdownComponents}
            />,
        );

        // End user sees the menu but not the marketplace divider
        expect(document.getElementById('divider_post_post_id_1_marketplace')).not.toBeInTheDocument();

        // Rerender with canOpenMarketplace - still as end user (no admin rights)
        rerender(
            <ActionsMenu
                {...baseProps}
                isSysAdmin={false}
                pluginMenuItems={dropdownComponents}
                canOpenMarketplace={false}
            />,
        );

        // End user shouldn't see marketplace divider
        expect(document.getElementById('divider_post_post_id_1_marketplace')).not.toBeInTheDocument();
    });
});
