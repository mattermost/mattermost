// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

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
            openModal: vi.fn(),
        },
        pluginMenuItems: [],
        isFirstAdmin: false,
        onboardingFlowEnabled: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for false of enableAskCommunityLink', () => {
        const props = {
            ...baseProps,
            enableAskCommunityLink: 'false',
        };

        const {container} = renderWithContext(
            <UserGuideDropdown {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when have plugin menu items', () => {
        const props = {
            ...baseProps,
            pluginMenuItems: [{id: 'testId', pluginId: 'testPluginId', text: 'Test Item', action: () => {}}],
        };

        const {container} = renderWithContext(
            <UserGuideDropdown {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('Should set state buttonActive on toggle of MenuWrapper', () => {
        renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        // Find and click the menu trigger button
        const menuButton = screen.getByLabelText('Help');
        expect(menuButton).toBeInTheDocument();

        // Click to open menu
        fireEvent.click(menuButton);

        // Menu should be open - check by looking for menu content
        expect(screen.getByText('Mattermost user guide')).toBeVisible();
    });

    test('Should set state buttonActive on toggle of MenuWrapper', () => {
        renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        // Open the menu first
        const menuButton = screen.getByLabelText('Help');
        fireEvent.click(menuButton);

        // Find and click the keyboard shortcuts menu item
        const keyboardShortcutsItem = screen.getByText('Keyboard shortcuts');
        fireEvent.click(keyboardShortcutsItem);

        expect(baseProps.actions.openModal).toHaveBeenCalled();
    });

    test('should have plugin menu items appended to the menu', () => {
        const props = {
            ...baseProps,
            pluginMenuItems: [{id: 'testId', pluginId: 'testPluginId', text: 'Test Plugin Item', action: () => {}}],
        };

        renderWithContext(
            <UserGuideDropdown {...props}/>,
        );

        // Open the menu
        const menuButton = screen.getByLabelText('Help');
        fireEvent.click(menuButton);

        // Plugin menu item should be visible
        expect(screen.getByText('Test Plugin Item')).toBeVisible();
    });

    test('should only render Report a Problem link when its value is non-empty', () => {
        const {rerender} = renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        // Open the menu
        let menuButton = screen.getByLabelText('Help');
        fireEvent.click(menuButton);

        expect(screen.getByText('Report a problem')).toBeInTheDocument();

        // Re-render with empty reportAProblemLink
        rerender(
            <UserGuideDropdown
                {...baseProps}
                reportAProblemLink={''}
            />,
        );

        // Open menu again
        menuButton = screen.getByLabelText('Help');
        fireEvent.click(menuButton);

        expect(screen.queryByText('Report a problem')).not.toBeInTheDocument();
    });
});
