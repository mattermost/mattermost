// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, it, expect, vi, beforeEach} from 'vitest';

import {renderWithIntl, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import ScrollToBottomToast from './scroll_to_bottom_toast';

describe('ScrollToBottomToast Component', () => {
    const mockOnDismiss = vi.fn();
    const mockOnClick = vi.fn();

    beforeEach(() => {
        mockOnDismiss.mockClear();
        mockOnClick.mockClear();
    });

    it('should render ScrollToBottomToast component', () => {
        const {container} = renderWithIntl(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        expect(container).toMatchSnapshot();

        // Assertions
        expect(screen.getByTestId('scroll-to-bottom-toast')).toBeInTheDocument();
        expect(screen.getByText('Jump to recents')).toBeInTheDocument();
        expect(screen.getByTestId('scroll-to-bottom-toast--dismiss-button')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        renderWithIntl(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        // Simulate click
        fireEvent.click(screen.getByTestId('scroll-to-bottom-toast'));

        // Expect the onClick function to be called
        expect(mockOnClick).toHaveBeenCalled();
    });

    it('should call onDismiss when close button is clicked', () => {
        renderWithIntl(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        // Simulate click on the close button
        fireEvent.click(screen.getByTestId('scroll-to-bottom-toast--dismiss-button'));

        // Expect the onDismiss function to be called
        expect(mockOnDismiss).toHaveBeenCalled();
    });
});
