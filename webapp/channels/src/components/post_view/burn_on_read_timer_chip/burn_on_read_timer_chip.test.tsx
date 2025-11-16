// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import BurnOnReadTimerChip from './burn_on_read_timer_chip';

describe('BurnOnReadTimerChip', () => {
    const baseProps = {
        postId: 'post123',
        durationMinutes: 10,
        onClick: jest.fn(),
        onExpire: jest.fn(),
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
                durationMinutes={0.5}
            />,
        );

        jest.advanceTimersByTime(1000);

        const chip = screen.getByRole('button');
        expect(chip).toHaveClass('BurnOnReadTimerChip--warning');
    });

    it('should call onExpire when timer completes', () => {
        const onExpire = jest.fn();
        renderWithContext(
            <BurnOnReadTimerChip
                {...baseProps}
                durationMinutes={0.03}
                onExpire={onExpire}
            />,
        );

        jest.advanceTimersByTime(3000);

        expect(onExpire).toHaveBeenCalledWith('post123');
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
