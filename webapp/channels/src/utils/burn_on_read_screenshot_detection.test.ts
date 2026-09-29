// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screenshotDetectionManager} from './burn_on_read_screenshot_detection';

describe('ScreenshotDetectionManager', () => {
    let callback: jest.Mock;

    beforeEach(() => {
        jest.useFakeTimers();
        callback = jest.fn();

        // Ensure clean state between tests
        while (screenshotDetectionManager.getRegistrationCount() > 0) {
            screenshotDetectionManager.unregister();
        }
    });

    afterEach(() => {
        while (screenshotDetectionManager.getRegistrationCount() > 0) {
            screenshotDetectionManager.unregister();
        }
        jest.useRealTimers();
    });

    describe('registration lifecycle', () => {
        it('should attach listeners on first registration', () => {
            const addSpy = jest.spyOn(window, 'addEventListener');

            screenshotDetectionManager.register(callback);

            expect(screenshotDetectionManager.getRegistrationCount()).toBe(1);
            expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
            expect(addSpy).toHaveBeenCalledWith('keyup', expect.any(Function), true);
            expect(addSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function), true);
            expect(addSpy).toHaveBeenCalledWith('blur', expect.any(Function), true);
            expect(addSpy).toHaveBeenCalledWith('focus', expect.any(Function), true);

            addSpy.mockRestore();
        });

        it('should not attach listeners on subsequent registrations', () => {
            screenshotDetectionManager.register(callback);

            const addSpy = jest.spyOn(window, 'addEventListener');

            screenshotDetectionManager.register(callback);

            expect(screenshotDetectionManager.getRegistrationCount()).toBe(2);
            expect(addSpy).not.toHaveBeenCalled();

            addSpy.mockRestore();
        });

        it('should detach listeners when last consumer unregisters', () => {
            const removeSpy = jest.spyOn(window, 'removeEventListener');

            screenshotDetectionManager.register(callback);
            screenshotDetectionManager.register(callback);

            screenshotDetectionManager.unregister();
            expect(screenshotDetectionManager.getRegistrationCount()).toBe(1);
            expect(removeSpy).not.toHaveBeenCalled();

            screenshotDetectionManager.unregister();
            expect(screenshotDetectionManager.getRegistrationCount()).toBe(0);
            expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
            expect(removeSpy).toHaveBeenCalledWith('keyup', expect.any(Function), true);
            expect(removeSpy).toHaveBeenCalledWith('contextmenu', expect.any(Function), true);

            removeSpy.mockRestore();
        });

        it('should not go below zero registrations', () => {
            screenshotDetectionManager.unregister();
            screenshotDetectionManager.unregister();

            expect(screenshotDetectionManager.getRegistrationCount()).toBe(0);
        });

        it('should re-attach listeners after full unregister and re-register', () => {
            screenshotDetectionManager.register(callback);
            screenshotDetectionManager.unregister();

            const addSpy = jest.spyOn(window, 'addEventListener');

            screenshotDetectionManager.register(callback);

            expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

            addSpy.mockRestore();
        });
    });

    describe('Mac screenshot detection', () => {
        beforeEach(() => {
            jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
            screenshotDetectionManager.register(callback);
        });

        it('should trigger callback when Cmd+Shift is held without a third key', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Meta', metaKey: true, shiftKey: true, bubbles: true}));

            jest.advanceTimersByTime(400);

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should not trigger callback when Cmd+Shift is followed by another key', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Meta', metaKey: true, shiftKey: true, bubbles: true}));
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', metaKey: true, shiftKey: true, bubbles: true}));

            jest.advanceTimersByTime(400);

            expect(callback).not.toHaveBeenCalled();
        });

        it('should cancel detection when modifiers are released', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Meta', metaKey: true, shiftKey: true, bubbles: true}));
            window.dispatchEvent(new KeyboardEvent('keyup', {key: 'Meta', metaKey: false, shiftKey: true, bubbles: true}));

            jest.advanceTimersByTime(400);

            expect(callback).not.toHaveBeenCalled();
        });
    });

    describe('Windows screenshot detection', () => {
        beforeEach(() => {
            jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
            screenshotDetectionManager.register(callback);
        });

        it('should trigger immediately on Win+Shift+S', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'Meta', metaKey: true, shiftKey: true, bubbles: true}));
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 's', metaKey: true, shiftKey: true, bubbles: true}));

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should trigger on PrintScreen', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'PrintScreen', code: 'PrintScreen', bubbles: true}));

            expect(callback).toHaveBeenCalledTimes(1);
        });
    });

    describe('throttling', () => {
        beforeEach(() => {
            jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
            screenshotDetectionManager.register(callback);
        });

        it('should throttle rapid triggers', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'PrintScreen', code: 'PrintScreen', bubbles: true}));
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'PrintScreen', code: 'PrintScreen', bubbles: true}));
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'PrintScreen', code: 'PrintScreen', bubbles: true}));

            expect(callback).toHaveBeenCalledTimes(1);
        });

        it('should allow trigger again after throttle window', () => {
            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'PrintScreen', code: 'PrintScreen', bubbles: true}));

            jest.advanceTimersByTime(2100);

            window.dispatchEvent(new KeyboardEvent('keydown', {key: 'PrintScreen', code: 'PrintScreen', bubbles: true}));

            expect(callback).toHaveBeenCalledTimes(2);
        });
    });

    describe('global context menu blocking', () => {
        it('should block right-click while registered', () => {
            screenshotDetectionManager.register(callback);

            const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
            const preventSpy = jest.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            expect(preventSpy).toHaveBeenCalled();
        });

        it('should not block right-click after all unregistered', () => {
            screenshotDetectionManager.register(callback);
            screenshotDetectionManager.unregister();

            const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true});
            const preventSpy = jest.spyOn(event, 'preventDefault');

            window.dispatchEvent(event);

            expect(preventSpy).not.toHaveBeenCalled();
        });
    });

    describe('window blur protection', () => {
        it('should add blur class when window loses focus', () => {
            screenshotDetectionManager.register(callback);

            jest.spyOn(document, 'hasFocus').mockReturnValue(false);
            window.dispatchEvent(new Event('blur'));

            jest.advanceTimersByTime(150);

            expect(document.body.classList.contains('bor-window-blurred')).toBe(true);
        });

        it('should remove blur class when window regains focus', () => {
            screenshotDetectionManager.register(callback);

            document.body.classList.add('bor-window-blurred');
            window.dispatchEvent(new Event('focus'));

            expect(document.body.classList.contains('bor-window-blurred')).toBe(false);
        });

        it('should not add blur class if document still has focus', () => {
            screenshotDetectionManager.register(callback);

            jest.spyOn(document, 'hasFocus').mockReturnValue(true);
            window.dispatchEvent(new Event('blur'));

            jest.advanceTimersByTime(150);

            expect(document.body.classList.contains('bor-window-blurred')).toBe(false);
        });

        it('should add blur class on visibility hidden', () => {
            screenshotDetectionManager.register(callback);

            Object.defineProperty(document, 'hidden', {value: true, writable: true});
            document.dispatchEvent(new Event('visibilitychange'));

            expect(document.body.classList.contains('bor-window-blurred')).toBe(true);

            Object.defineProperty(document, 'hidden', {value: false, writable: true});
        });

        it('should clean up blur class on detach', () => {
            screenshotDetectionManager.register(callback);

            document.body.classList.add('bor-window-blurred');

            screenshotDetectionManager.unregister();

            expect(document.body.classList.contains('bor-window-blurred')).toBe(false);
        });
    });
});
