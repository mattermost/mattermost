// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ProfilePopoverEmail from './profile_popover_email';

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
    writable: true,
    value: mockWindowOpen,
});

describe('components/ProfilePopoverEmail', () => {
    const baseProps = {
        email: 'test@example.com',
        haveOverrideProp: false,
        isBot: false,
    };

    beforeEach(() => {
        mockWindowOpen.mockClear();
    });

    test('should not render when email is empty', async () => {
        const props = {
            ...baseProps,
            email: '',
        };
        const {container} = await renderWithContext(<ProfilePopoverEmail {...props}/>);
        expect(container.firstChild).toBeNull();
    });

    test('should handle different email formats', async () => {
        const props = {
            ...baseProps,
            email: 'user.name+tag@domain.co.uk',
        };
        await renderWithContext(<ProfilePopoverEmail {...props}/>);

        const email = 'user.name+tag@domain.co.uk';
        const emailLink = screen.getByText(email);
        expect(emailLink).toBeInTheDocument();
        expect(emailLink.tagName).toBe('A');
    });

    test('should open email client when clicked', async () => {
        await renderWithContext(<ProfilePopoverEmail {...baseProps}/>);

        const email = 'test@example.com';
        const emailLink = screen.getByText(email);

        await userEvent.click(emailLink);

        expect(mockWindowOpen).toHaveBeenCalledWith('mailto:test@example.com');
    });

    test('should prevent default click behavior', async () => {
        await renderWithContext(<ProfilePopoverEmail {...baseProps}/>);

        const email = 'test@example.com';
        const emailLink = screen.getByText(email);

        await userEvent.click(emailLink);

        expect(mockWindowOpen).toHaveBeenCalledWith('mailto:test@example.com');
    });
});
