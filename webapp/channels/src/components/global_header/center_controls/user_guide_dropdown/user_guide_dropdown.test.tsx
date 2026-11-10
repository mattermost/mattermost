// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, fireEvent} from 'tests/react_testing_utils';

import UserGuideDropdown, {getMattermostDocumentationURL, MATTERMOST_DOCS_URL} from './user_guide_dropdown';

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
        siteURL: 'http://localhost:8065',
    };

    const openMenu = () => {
        const button = screen.getByLabelText('Help');
        fireEvent.click(button);
    };

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
            pluginMenuItems: [{id: 'testId', pluginId: 'testPluginId', text: 'Test Item', action: () => {}},
            ],
        };

        const {container} = renderWithContext(
            <UserGuideDropdown {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('Should render with buttonActive initially false', () => {
        const {container} = renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        // The button should not be pressed/expanded initially
        const button = container.querySelector('button[aria-label="Help"]');
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    test('Should open keyboard shortcuts modal on click', async () => {
        renderWithContext(
            <UserGuideDropdown {...baseProps}/>,
        );

        openMenu();
        const shortcutsItem = screen.getByText('Keyboard shortcuts');
        await userEvent.click(shortcutsItem);
        expect(baseProps.actions.openModal).toHaveBeenCalled();
    });

    test('should have plugin menu items appended to the menu', () => {
        const props = {
            ...baseProps,
            pluginMenuItems: [{id: 'testId', pluginId: 'testPluginId', text: 'Test Plugin Item', action: () => {}},
            ],
        };

        renderWithContext(
            <UserGuideDropdown {...props}/>,
        );

        openMenu();

        // pluginMenuItems are appended, so our entry must be the last one.
        expect(screen.getByText('Test Plugin Item')).toBeInTheDocument();
    });

    test('should only render Report a Problem link when its value is non-empty', () => {
        const {rerender} = renderWithContext(
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

    test('links Mattermost documentation to bundled docs on a root SiteURL', () => {
        renderWithContext(
            <UserGuideDropdown
                {...baseProps}
                siteURL='https://chat.example.com'
            />,
        );

        openMenu();
        expect(screen.getByRole('link', {name: 'Mattermost documentation'})).toHaveAttribute(
            'href',
            'https://chat.example.com/_documentation/',
        );
    });

    test('links Mattermost documentation to the public docs site when SiteURL has a subpath', () => {
        renderWithContext(
            <UserGuideDropdown
                {...baseProps}
                siteURL='https://example.com/mattermost'
            />,
        );

        openMenu();
        const link = screen.getByRole('link', {name: 'Mattermost documentation'});
        expect(link).toHaveAttribute('href', expect.stringContaining(MATTERMOST_DOCS_URL));
        expect(link).not.toHaveAttribute('href', expect.stringContaining('/_documentation/'));
    });
});

describe('getMattermostDocumentationURL', () => {
    test.each([
        ['https://chat.example.com', 'https://chat.example.com/_documentation/'],
        ['https://chat.example.com/', 'https://chat.example.com/_documentation/'],
        ['http://localhost:8065', 'http://localhost:8065/_documentation/'],
        ['https://example.com/mattermost', MATTERMOST_DOCS_URL],
        ['https://example.com/mattermost/', MATTERMOST_DOCS_URL],
        ['', MATTERMOST_DOCS_URL],
        ['not a url', MATTERMOST_DOCS_URL],
    ])('maps %s', (siteURL, expected) => {
        expect(getMattermostDocumentationURL(siteURL)).toBe(expected);
    });
});
