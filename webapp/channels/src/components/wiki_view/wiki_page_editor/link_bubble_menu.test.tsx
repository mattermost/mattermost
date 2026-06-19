// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';

import LinkBubbleMenu from './link_bubble_menu';

// Mock TipTap BubbleMenu since it requires editor context
jest.mock('@tiptap/react/menus', () => ({
    BubbleMenu: ({children, shouldShow}: {children: React.ReactNode; shouldShow: (args: {editor: any}) => boolean}) => {
        const mockEditor = {
            state: {selection: {empty: true}},
            isActive: () => true,
        };
        if (shouldShow({editor: mockEditor})) {
            return <div data-testid='bubble-menu-wrapper'>{children}</div>;
        }
        return null;
    },
}));

// Mock browser history
jest.mock('utils/browser_history', () => ({
    getHistory: jest.fn(() => ({
        push: jest.fn(),
    })),
}));

describe('components/wiki_view/wiki_page_editor/LinkBubbleMenu', () => {
    const mockEditor = {
        chain: jest.fn(() => ({
            focus: jest.fn(() => ({
                unsetLink: jest.fn(() => ({
                    run: jest.fn(),
                })),
            })),
        })),
        getAttributes: jest.fn(() => ({href: 'https://example.com'})),
        state: {
            selection: {empty: true},
        },
        isActive: jest.fn(() => true),
    };

    const onEditLink = jest.fn();

    const renderWithIntl = (component: React.ReactNode) => {
        return render(
            <IntlProvider locale='en'>
                {component}
            </IntlProvider>,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders null when editor is null', () => {
        const {container} = renderWithIntl(
            <LinkBubbleMenu
                editor={null}
                onEditLink={onEditLink}
            />,
        );

        expect(container.firstChild).toBeNull();
    });

    test('renders link bubble menu with action buttons when editor is provided', () => {
        const {getByTestId} = renderWithIntl(
            <LinkBubbleMenu
                editor={mockEditor as any}
                onEditLink={onEditLink}
            />,
        );

        expect(getByTestId('link-bubble-menu')).toBeInTheDocument();
        expect(getByTestId('link-open-button')).toBeInTheDocument();
        expect(getByTestId('link-copy-button')).toBeInTheDocument();
        expect(getByTestId('link-edit-button')).toBeInTheDocument();
        expect(getByTestId('link-unlink-button')).toBeInTheDocument();
    });

    test('displays link URL from editor', () => {
        const {getByText} = renderWithIntl(
            <LinkBubbleMenu
                editor={mockEditor as any}
                onEditLink={onEditLink}
            />,
        );

        expect(getByText('https://example.com')).toBeInTheDocument();
    });

    test('truncates long URLs', () => {
        const longUrlEditor = {
            ...mockEditor,
            getAttributes: jest.fn(() => ({
                href: 'https://example.com/very/long/path/that/exceeds/the/maximum/display/length',
            })),
        };

        const {getByText} = renderWithIntl(
            <LinkBubbleMenu
                editor={longUrlEditor as any}
                onEditLink={onEditLink}
            />,
        );

        // Should truncate to 40 chars + '...'
        expect(getByText(/\.\.\.$/)).toBeInTheDocument();
    });
});
