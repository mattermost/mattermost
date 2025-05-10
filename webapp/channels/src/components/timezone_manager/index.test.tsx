// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, render} from '@testing-library/react';
import React from 'react';

import TimezoneManager from '.';

jest.mock('utils/timezone', () => ({
    getBrowserTimezone: jest.fn().mockReturnValue('America/New_York'),
}));

describe('components/timezone_manager/TimezoneManager', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    it('should update timezone on mount', () => {
        const autoUpdateTimezone = jest.fn();
        render(<TimezoneManager autoUpdateTimezone={autoUpdateTimezone}/>);

        expect(autoUpdateTimezone).toHaveBeenCalledTimes(1);
        expect(autoUpdateTimezone).toHaveBeenCalledWith('America/New_York');
    });

    it('should update timezone periodically every minute', () => {
        const autoUpdateTimezone = jest.fn();
        render(<TimezoneManager autoUpdateTimezone={autoUpdateTimezone}/>);

        // Clear initial call
        autoUpdateTimezone.mockClear();

        // Fast-forward 1 minute
        act(() => {
            jest.advanceTimersByTime(60 * 1000);
        });

        expect(autoUpdateTimezone).toHaveBeenCalledTimes(1);
        expect(autoUpdateTimezone).toHaveBeenCalledWith('America/New_York');

        // Fast-forward another minute
        autoUpdateTimezone.mockClear();
        act(() => {
            jest.advanceTimersByTime(60 * 1000);
        });

        expect(autoUpdateTimezone).toHaveBeenCalledTimes(1);
        expect(autoUpdateTimezone).toHaveBeenCalledWith('America/New_York');
    });

    it('should clean up interval on unmount', () => {
        const {unmount} = render(<TimezoneManager autoUpdateTimezone={jest.fn()}/>);

        // We should have 1 timer (the interval) before unmounting
        expect(jest.getTimerCount()).toBe(1);

        unmount();

        // After unmounting, all timers should be cleared
        expect(jest.getTimerCount()).toBe(0);
    });
});
