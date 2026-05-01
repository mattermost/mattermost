// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import ScrollToBottomToast from './scroll_to_bottom_toast';

describe('ScrollToBottomToast Component', () => {
    const mockOnDismiss = jest.fn();
    const mockOnClick = jest.fn();

    it('should render ScrollToBottomToast component', () => {
        const {container} = renderWithContext(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        expect(container.querySelector('.scroll-to-bottom-toast')).toBeInTheDocument();
        expect(screen.getByText('Jump to recents')).toBeInTheDocument();
        expect(container.querySelector('.scroll-to-bottom-toast__dismiss')).toBeInTheDocument();
    });

    it('should call onClick when clicked', async () => {
        const {container} = renderWithContext(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        await userEvent.click(container.querySelector('.scroll-to-bottom-toast')!);

        expect(mockOnClick).toHaveBeenCalled();
    });

    it('should call onDismiss when close button is clicked', async () => {
        const {container} = renderWithContext(
            <ScrollToBottomToast
                onDismiss={mockOnDismiss}
                onClick={mockOnClick}
            />,
        );

        await userEvent.click(container.querySelector('.scroll-to-bottom-toast__dismiss')!);

        expect(mockOnDismiss).toHaveBeenCalled();
    });
});

