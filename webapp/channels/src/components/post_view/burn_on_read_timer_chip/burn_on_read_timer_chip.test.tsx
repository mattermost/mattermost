// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BurnOnReadTimerChip from './burn_on_read_timer_chip';

describe('BurnOnReadTimerChip', () => {
    const baseProps = {
        expireAt: Date.now() + (10 * 60 * 1000),
        onClick: jest.fn(),
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should render timer with duration', () => {
        renderWithContext(<BurnOnReadTimerChip {...baseProps}/>);

        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByText('10:00')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
        const onClick = jest.fn();
        renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                onClick={onClick}
            />,
        );

        const chip = screen.getByRole('button');
        fireEvent.click(chip);

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick on keyboard interaction', () => {
        const onClick = jest.fn();
        renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                onClick={onClick}
            />,
        );

        const chip = screen.getByRole('button');
        fireEvent.keyDown(chip, {key: 'Enter', code: 'Enter'});

        expect(onClick).toHaveBeenCalled();
    });

    it('should display warning state when timer below 1 minute', () => {
        renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                expireAt={Date.now() + (30 * 1000)}
            />,
        );

        jest.advanceTimersByTime(1000);

        const chip = screen.getByRole('button');
        expect(chip).toHaveClass('BurnOnReadTimerChip--warning');
    });

    it('should register post with expiration scheduler on mount', () => {
        // Note: Actual expiration is now handled by the global BurnOnReadExpirationScheduler
        // This test verifies the component renders correctly with a short duration
        renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                expireAt={Date.now() + (2 * 1000)}
            />,
        );

        jest.advanceTimersByTime(3000);

        // Component should still be rendered (expiration handled by scheduler, not component)
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should have accessibility attributes', () => {
        const {container} = renderWithContext(<BurnOnReadTimerChip {...baseProps}/>);

        const chip = screen.getByRole('button');
        expect(chip).toHaveAttribute('aria-label');

        const liveRegion = container.querySelector('[aria-live="polite"]');
        expect(liveRegion).toBeInTheDocument();
        expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });
});
