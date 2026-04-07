// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, fireEvent} from 'tests/react_testing_utils';

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

    const openMenu = () => {
        const button = screen.getByLabelText('Help');
        fireEvent.click(button);
    };

    test('should match snapshot', async () => {
        const {container} = await renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot for false of enableAskCommunityLink', async () => {
        const props = {
            ...baseProps,
            enableAskCommunityLink: 'false',
        };

        const {container} = await renderWithContext(
            <UserGuideDropdown {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when have plugin menu items', async () => {
        const props = {
            ...baseProps,
            pluginMenuItems: [{id: 'testId', pluginId: 'testPluginId', text: 'Test Item', action: () => {}},
            ],
        };

        const {container} = await renderWithContext(
            <UserGuideDropdown {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('Should render with buttonActive initially false', async () => {
        const {container} = await renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        // The button should not have the 'active' class initially
        const button = container.querySelector('.HeaderIconButton');
        expect(button).toBeInTheDocument();
        expect(button).not.toHaveClass('active');
    });

    test('Should open keyboard shortcuts modal on click', async () => {
        await renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        openMenu();
        const shortcutsItem = screen.getByText('Keyboard shortcuts');
        await userEvent.click(shortcutsItem);
        expect(baseProps.actions.openModal).toHaveBeenCalled();
    });

    test('should have plugin menu items appended to the menu', async () => {
        const props = {
            ...baseProps,
            pluginMenuItems: [{id: 'testId', pluginId: 'testPluginId', text: 'Test Plugin Item', action: () => {}},
            ],
        };

        await renderWithContext(
            <UserGuideDropdown {...props}/>,
        );

        openMenu();

        // pluginMenuItems are appended, so our entry must be the last one.
        expect(screen.getByText('Test Plugin Item')).toBeInTheDocument();
    });

    test('should only render Report a Problem link when its value is non-empty', async () => {
        const {rerender} = await renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        openMenu();
        expect(screen.getByText('Report a problem')).toBeInTheDocument();

        rerender(
            <UserGuideDropdown
                {...baseProps}
                reportAProblemLink=''
            />,
        );

        expect(screen.queryByText('Report a problem')).not.toBeInTheDocument();
    });
});
