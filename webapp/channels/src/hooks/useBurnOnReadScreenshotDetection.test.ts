// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';

import {screenshotDetectionManager} from 'utils/burn_on_read_screenshot_detection';

import {useBurnOnReadScreenshotDetection} from './useBurnOnReadScreenshotDetection';

jest.mock('utils/burn_on_read_screenshot_detection', () => ({
    screenshotDetectionManager: {
        register: jest.fn(),
        unregister: jest.fn(),
    },
}));

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => jest.fn(),
}));

describe('useBurnOnReadScreenshotDetection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should register with manager when visible', () => {
        renderHook(() => useBurnOnReadScreenshotDetection(true));

        expect(screenshotDetectionManager.register).toHaveBeenCalledTimes(1);
        expect(screenshotDetectionManager.register).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not register when not visible', () => {
        renderHook(() => useBurnOnReadScreenshotDetection(false));

        expect(screenshotDetectionManager.register).not.toHaveBeenCalled();
    });

    it('should unregister on unmount', () => {
        const {unmount} = renderHook(() => useBurnOnReadScreenshotDetection(true));

        unmount();

        expect(screenshotDetectionManager.unregister).toHaveBeenCalledTimes(1);
    });

    it('should unregister when visibility changes to false', () => {
        const {rerender} = renderHook(
            ({isVisible}) => useBurnOnReadScreenshotDetection(isVisible),
            {initialProps: {isVisible: true}},
        );

        expect(screenshotDetectionManager.register).toHaveBeenCalledTimes(1);

        rerender({isVisible: false});

        expect(screenshotDetectionManager.unregister).toHaveBeenCalledTimes(1);
    });

    it('should not unregister when not visible and unmounting', () => {
        const {unmount} = renderHook(() => useBurnOnReadScreenshotDetection(false));

        unmount();

        expect(screenshotDetectionManager.unregister).not.toHaveBeenCalled();
    });
});
