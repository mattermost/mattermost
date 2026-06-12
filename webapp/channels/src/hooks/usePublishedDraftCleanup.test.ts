// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';

import * as PagesActions from 'actions/pages';

import {usePublishedDraftCleanup} from './usePublishedDraftCleanup';

jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn(),
}));

jest.mock('actions/pages');

const mockCleanupPublishedDraftTimestamps = PagesActions.cleanupPublishedDraftTimestamps as jest.MockedFunction<typeof PagesActions.cleanupPublishedDraftTimestamps>;

describe('usePublishedDraftCleanup', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should start cleanup interval on mount', () => {
        mockCleanupPublishedDraftTimestamps.mockReturnValue(jest.fn() as any);

        renderHook(() => usePublishedDraftCleanup());

        // Should not be called immediately
        expect(mockCleanupPublishedDraftTimestamps).not.toHaveBeenCalled();

        // After 60 seconds, should be called
        jest.advanceTimersByTime(60000);
        expect(mockCleanupPublishedDraftTimestamps).toHaveBeenCalledTimes(1);
    });

    test('should call cleanup every 60 seconds', () => {
        mockCleanupPublishedDraftTimestamps.mockReturnValue(jest.fn() as any);

        renderHook(() => usePublishedDraftCleanup());

        jest.advanceTimersByTime(60000);
        expect(mockCleanupPublishedDraftTimestamps).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(60000);
        expect(mockCleanupPublishedDraftTimestamps).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(60000);
        expect(mockCleanupPublishedDraftTimestamps).toHaveBeenCalledTimes(3);
    });

    test('should clear interval on unmount', () => {
        mockCleanupPublishedDraftTimestamps.mockReturnValue(jest.fn() as any);

        const {unmount} = renderHook(() => usePublishedDraftCleanup());

        // Advance partially
        jest.advanceTimersByTime(30000);

        // Unmount
        unmount();

        // Advance past when next cleanup would occur
        jest.advanceTimersByTime(60000);

        // Should not have been called since we unmounted before 60s
        expect(mockCleanupPublishedDraftTimestamps).not.toHaveBeenCalled();
    });

    test('should not call cleanup before 60 seconds', () => {
        mockCleanupPublishedDraftTimestamps.mockReturnValue(jest.fn() as any);

        renderHook(() => usePublishedDraftCleanup());

        jest.advanceTimersByTime(59999);
        expect(mockCleanupPublishedDraftTimestamps).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(mockCleanupPublishedDraftTimestamps).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple mount/unmount cycles', () => {
        mockCleanupPublishedDraftTimestamps.mockReturnValue(jest.fn() as any);

        // First mount
        const {unmount: unmount1} = renderHook(() => usePublishedDraftCleanup());
        jest.advanceTimersByTime(60000);
        expect(mockCleanupPublishedDraftTimestamps).toHaveBeenCalledTimes(1);
        unmount1();

        // Second mount
        const {unmount: unmount2} = renderHook(() => usePublishedDraftCleanup());
        jest.advanceTimersByTime(60000);
        expect(mockCleanupPublishedDraftTimestamps).toHaveBeenCalledTimes(2);
        unmount2();

        // After unmount, no more calls
        jest.advanceTimersByTime(120000);
        expect(mockCleanupPublishedDraftTimestamps).toHaveBeenCalledTimes(2);
    });
});
