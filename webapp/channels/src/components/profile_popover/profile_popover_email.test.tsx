// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

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

    test('should not render when email is empty', () => {
        const props = {
            ...baseProps,
            email: '',
        };
        const {container} = renderWithContext(<ProfilePopoverEmail {...props}/>);
        expect(container.firstChild).toBeNull();
    });

    test('should handle different email formats', () => {
        const props = {
            ...baseProps,
            email: 'user.name+tag@domain.co.uk',
        };
        renderWithContext(<ProfilePopoverEmail {...props}/>);

        const email = 'user.name+tag@domain.co.uk';
        const emailLink = screen.getByText(email);
        expect(emailLink).toBeInTheDocument();
        expect(emailLink.tagName).toBe('A');
    });

    test('should open email client when clicked', () => {
        renderWithContext(<ProfilePopoverEmail {...baseProps}/>);

        const email = 'test@example.com';
        const emailLink = screen.getByText(email);

        fireEvent.click(emailLink);

        expect(mockWindowOpen).toHaveBeenCalledWith('mailto:test@example.com');
    });

    test('should prevent default click behavior', () => {
        renderWithContext(<ProfilePopoverEmail {...baseProps}/>);

        const email = 'test@example.com';
        const emailLink = screen.getByText(email);

        const clickEvent = fireEvent.click(emailLink);

        expect(clickEvent).toBe(false); // fireEvent.click returns false when preventDefault was called
        expect(mockWindowOpen).toHaveBeenCalledWith('mailto:test@example.com');
    });
});
