// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import BurnOnReadConcealedPlaceholder from './burn_on_read_concealed_placeholder';

describe('BurnOnReadConcealedPlaceholder', () => {
    const baseProps = {
        postId: 'post123',
        authorName: 'john.doe',
        onReveal: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render with concealed placeholder text', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder {...baseProps}/>,
        );

        expect(screen.getByTestId('burn-on-read-concealed-post123')).toBeInTheDocument();
        expect(screen.getByText('View message')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveClass('BurnOnReadConcealedPlaceholder');
    });

    it('should call onReveal when clicked', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder {...baseProps}/>,
        );

        const placeholder = screen.getByRole('button');
        fireEvent.click(placeholder);

        expect(baseProps.onReveal).toHaveBeenCalledWith('post123');
        expect(baseProps.onReveal).toHaveBeenCalledTimes(1);
    });

    it('should call onReveal when Enter key is pressed', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder {...baseProps}/>,
        );

        const placeholder = screen.getByRole('button');
        fireEvent.keyDown(placeholder, {key: 'Enter'});

        expect(baseProps.onReveal).toHaveBeenCalledWith('post123');
    });

    it('should call onReveal when Space key is pressed', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder {...baseProps}/>,
        );

        const placeholder = screen.getByRole('button');
        fireEvent.keyDown(placeholder, {key: ' '});

        expect(baseProps.onReveal).toHaveBeenCalledWith('post123');
    });

    it('should not call onReveal when other keys are pressed', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder {...baseProps}/>,
        );

        const placeholder = screen.getByRole('button');
        fireEvent.keyDown(placeholder, {key: 'a'});

        expect(baseProps.onReveal).not.toHaveBeenCalled();
    });

    it('should show loading spinner when loading', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder
                {...baseProps}
                loading={true}
            />,
        );

        expect(screen.getByTestId('burn-on-read-concealed-post123')).toHaveClass('BurnOnReadConcealedPlaceholder--loading');
        expect(screen.queryByText('Click to Reveal')).not.toBeInTheDocument();
    });

    it('should not trigger onReveal when loading', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder
                {...baseProps}
                loading={true}
            />,
        );

        const placeholder = screen.getByRole('button');
        fireEvent.click(placeholder);

        expect(baseProps.onReveal).not.toHaveBeenCalled();
    });

    it('should display error message when error is present', () => {
        const errorMessage = 'Failed to reveal message';
        renderWithContext(
            <BurnOnReadConcealedPlaceholder
                {...baseProps}
                error={errorMessage}
            />,
        );

        expect(screen.getByText('Unable to reveal message. Please try again later.')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toHaveClass('BurnOnReadConcealedPlaceholder--error');
    });

    it('should have correct aria-label for accessibility', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder {...baseProps}/>,
        );

        const placeholder = screen.getByRole('button');
        expect(placeholder).toHaveAttribute('aria-label', 'Burn-on-read message from john.doe. Click to reveal content.');
    });

    it('should be keyboard focusable', () => {
        renderWithContext(
            <BurnOnReadConcealedPlaceholder {...baseProps}/>,
        );

        const placeholder = screen.getByRole('button');
        expect(placeholder).toHaveAttribute('tabIndex', '0');
    });
});
