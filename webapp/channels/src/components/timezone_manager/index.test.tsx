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

    it('should update timezone on window focus', () => {
        const autoUpdateTimezone = jest.fn();
        render(<TimezoneManager autoUpdateTimezone={autoUpdateTimezone}/>);

        // Clear initial call
        autoUpdateTimezone.mockClear();

        // Simulate window focus
        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        expect(autoUpdateTimezone).toHaveBeenCalledTimes(1);
        expect(autoUpdateTimezone).toHaveBeenCalledWith('America/New_York');
    });

    it('should update timezone periodically', () => {
        const autoUpdateTimezone = jest.fn();
        render(<TimezoneManager autoUpdateTimezone={autoUpdateTimezone}/>);

        // Clear initial call
        autoUpdateTimezone.mockClear();

        // Fast-forward 30 minutes
        act(() => {
            jest.advanceTimersByTime(30 * 60 * 1000);
        });

        expect(autoUpdateTimezone).toHaveBeenCalledTimes(1);
        expect(autoUpdateTimezone).toHaveBeenCalledWith('America/New_York');
    });

    it('should clean up listeners and interval on unmount', () => {
        const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
        const clearIntervalSpy = jest.spyOn(window, 'clearInterval');

        const {unmount} = render(<TimezoneManager autoUpdateTimezone={jest.fn()}/>);

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
        expect(clearIntervalSpy).toHaveBeenCalled();

        removeEventListenerSpy.mockRestore();
        clearIntervalSpy.mockRestore();
    });
});
