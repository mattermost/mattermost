// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import BurnOnReadTimerChip from './burn_on_read_timer_chip';

describe('BurnOnReadTimerChip', () => {
    const baseProps = {
        expireAt: Date.now() + (10 * 60 * 1000),
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should render timer with duration', async () => {
        await renderWithContext(<BurnOnReadTimerChip {...baseProps}/>);

        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByText('10:00')).toBeInTheDocument();
    });

    it('should call onClick when clicked', async () => {
        const onClick = jest.fn();
        await renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                onClick={onClick}
            />,
        );

        const chip = screen.getByRole('button');

        // Click the timer chip to verify onClick handler is called - fireEvent used because userEvent doesn't work well with fake timers
        fireEvent.click(chip);

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick on keyboard interaction', async () => {
        const onClick = jest.fn();
        await renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                onClick={onClick}
            />,
        );

        const chip = screen.getByRole('button');

        // Press Enter key to verify keyboard accessibility for the timer chip - fireEvent used because userEvent doesn't work well with fake timers
        fireEvent.keyDown(chip, {key: 'Enter', code: 'Enter'});

        expect(onClick).toHaveBeenCalled();
    });

    it('should display warning state when timer below 1 minute', async () => {
        await renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                expireAt={Date.now() + (30 * 1000)}
            />,
        );

        jest.advanceTimersByTime(1000);

        const chip = screen.getByRole('button');
        expect(chip).toHaveClass('BurnOnReadTimerChip--warning');
    });

    it('should register post with expiration scheduler on mount', async () => {
        // Note: Actual expiration is now handled by the global BurnOnReadExpirationScheduler
        // This test verifies the component renders correctly with a short duration
        await renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                expireAt={Date.now() + (2 * 1000)}
            />,
        );

        jest.advanceTimersByTime(3000);

        // Component should still be rendered (expiration handled by scheduler, not component)
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have accessibility attributes', async () => {
        const {container} = await renderWithContext(<BurnOnReadTimerChip {...baseProps}/>);

        const chip = screen.getByRole('button');
        expect(chip).toHaveAttribute('aria-label');

        const liveRegion = container.querySelector('[aria-live="polite"]');
        expect(liveRegion).toBeInTheDocument();
        expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });
});
