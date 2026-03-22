// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Singleton that provides screenshot deterrence for Burn-on-Read messages.
 *
 * - Detects platform-specific screenshot shortcuts (Cmd+Shift on Mac,
 *   Win+Shift+S / PrintScreen on Windows/Linux) and fires a callback.
 * - Applies a CSS blur class to BoR content when the window loses focus.
 *
 * Uses ref-counting so listeners attach on the first registration
 * and detach when all consumers unregister.
 */

type ScreenshotDetectedCallback = () => void;
type TimeoutHandle = ReturnType<typeof setTimeout>;

const SCREENSHOT_DETECTION_DELAY_MS = 350;
const CALLBACK_THROTTLE_MS = 2000;
const BLUR_SETTLE_DELAY_MS = 100;

function detectPlatform(): {isMac: boolean; isWindows: boolean; isLinux: boolean} {
    const userAgentData = (navigator as Navigator & {userAgentData?: {platform?: string}}).userAgentData;
    if (userAgentData?.platform) {
        const platform = userAgentData.platform.toUpperCase();
        return {
            isMac: platform.includes('MAC'),
            isWindows: platform.includes('WIN'),
            isLinux: platform.includes('LINUX'),
        };
    }

    const ua = navigator.userAgent.toUpperCase();
    return {
        isMac: ua.includes('MAC'),
        isWindows: ua.includes('WIN'),
        isLinux: ua.includes('LINUX'),
    };
}

const BLUR_CLASS = 'bor-window-blurred';

class ScreenshotDetectionManager {
    private listenerCount = 0;
    private isListenerRegistered = false;
    private callback: ScreenshotDetectedCallback | null = null;

    private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
    private keyupHandler: ((e: KeyboardEvent) => void) | null = null;
    private contextMenuHandler: ((e: MouseEvent) => void) | null = null;
    private blurHandler: (() => void) | null = null;
    private focusHandler: (() => void) | null = null;
    private visibilityChangeHandler: (() => void) | null = null;

    private cmdKeyPressed = false;
    private shiftKeyPressed = false;
    private otherKeyPressed = false;
    private lastCallbackTime = 0;
    private warningTimeout: TimeoutHandle | null = null;
    private blurSettleTimeout: TimeoutHandle | null = null;

    public register(callback: ScreenshotDetectedCallback): void {
        this.listenerCount++;

        // Single callback by design — ref-counting controls listener lifecycle only.
        this.callback = callback;

        if (!this.isListenerRegistered) {
            this.attachListeners();
        }
    }

    public unregister(): void {
        this.listenerCount = Math.max(0, this.listenerCount - 1);

        if (this.listenerCount === 0) {
            this.detachListeners();
        }
    }

    public getRegistrationCount(): number {
        return this.listenerCount;
    }

    private attachListeners(): void {
        if (this.isListenerRegistered) {
            return;
        }

        const {isMac, isWindows, isLinux} = detectPlatform();

        this.keydownHandler = (e: KeyboardEvent) => {
            this.handleKeyDown(e, isMac, isWindows, isLinux);
        };

        this.keyupHandler = (e: KeyboardEvent) => {
            this.handleKeyUp(e, isMac, isWindows);
        };

        // Block right-click globally while any revealed BoR message is visible.
        this.contextMenuHandler = (e: MouseEvent) => {
            e.preventDefault();
        };

        this.blurHandler = () => {
            this.handleWindowBlur();
        };

        this.focusHandler = () => {
            this.handleWindowFocus();
        };

        this.visibilityChangeHandler = () => {
            this.handleVisibilityChange();
        };

        // Capture phase to intercept before other handlers
        window.addEventListener('keydown', this.keydownHandler, true);
        window.addEventListener('keyup', this.keyupHandler, true);
        window.addEventListener('contextmenu', this.contextMenuHandler, true);
        window.addEventListener('blur', this.blurHandler, true);
        window.addEventListener('focus', this.focusHandler, true);
        document.addEventListener('visibilitychange', this.visibilityChangeHandler, true);

        this.isListenerRegistered = true;
    }

    private detachListeners(): void {
        if (this.keydownHandler) {
            window.removeEventListener('keydown', this.keydownHandler, true);
            this.keydownHandler = null;
        }
        if (this.keyupHandler) {
            window.removeEventListener('keyup', this.keyupHandler, true);
            this.keyupHandler = null;
        }
        if (this.contextMenuHandler) {
            window.removeEventListener('contextmenu', this.contextMenuHandler, true);
            this.contextMenuHandler = null;
        }
        if (this.blurHandler) {
            window.removeEventListener('blur', this.blurHandler, true);
            this.blurHandler = null;
        }
        if (this.focusHandler) {
            window.removeEventListener('focus', this.focusHandler, true);
            this.focusHandler = null;
        }
        if (this.visibilityChangeHandler) {
            document.removeEventListener('visibilitychange', this.visibilityChangeHandler, true);
            this.visibilityChangeHandler = null;
        }

        document.body.classList.remove(BLUR_CLASS);

        this.clearWarningTimeout();
        this.clearBlurSettleTimeout();
        this.resetState();
    }

    private handleKeyDown(e: KeyboardEvent, isMac: boolean, isWindows: boolean, isLinux: boolean): void {
        if ((isWindows || isLinux) && (e.key === 'PrintScreen' || e.code === 'PrintScreen')) {
            this.triggerCallbackThrottled();
            return;
        }

        if (isMac) {
            this.handleMacScreenshotDetection(e);
        }

        if (isWindows) {
            this.handleWindowsScreenshotDetection(e);
        }
    }

    // Cmd+Shift held without a third key within the delay → likely a screenshot shortcut.
    private handleMacScreenshotDetection(e: KeyboardEvent): void {
        const wasModifiersPressed = this.cmdKeyPressed && this.shiftKeyPressed;

        this.cmdKeyPressed = e.metaKey;
        this.shiftKeyPressed = e.shiftKey;

        const modifiersNowPressed = this.cmdKeyPressed && this.shiftKeyPressed;

        if (modifiersNowPressed && !wasModifiersPressed) {
            this.otherKeyPressed = false;
            this.startScreenshotDetectionTimer();
        }

        // Non-modifier key while held → regular shortcut, cancel detection
        if (modifiersNowPressed && !this.isModifierKey(e.key)) {
            this.otherKeyPressed = true;
            this.clearWarningTimeout();
        }
    }

    // Win+Shift+S triggers immediately; other combos use the same delay heuristic.
    private handleWindowsScreenshotDetection(e: KeyboardEvent): void {
        const wasModifiersPressed = this.cmdKeyPressed && this.shiftKeyPressed;

        this.cmdKeyPressed = e.metaKey;
        this.shiftKeyPressed = e.shiftKey;

        const modifiersNowPressed = this.cmdKeyPressed && this.shiftKeyPressed;

        if (modifiersNowPressed && !wasModifiersPressed) {
            this.otherKeyPressed = false;
            this.startScreenshotDetectionTimer();
        }

        if (modifiersNowPressed && e.key.toLowerCase() === 's') {
            this.clearWarningTimeout();
            this.triggerCallbackThrottled();
            return;
        }

        if (modifiersNowPressed && !this.isModifierKey(e.key) && e.key.toLowerCase() !== 's') {
            this.otherKeyPressed = true;
            this.clearWarningTimeout();
        }
    }

    private handleKeyUp(e: KeyboardEvent, isMac: boolean, isWindows: boolean): void {
        if (isMac || isWindows) {
            this.cmdKeyPressed = e.metaKey;
            this.shiftKeyPressed = e.shiftKey;

            if (!this.cmdKeyPressed || !this.shiftKeyPressed) {
                this.clearWarningTimeout();
            }
        }
    }

    // Delay lets focus settle to avoid false positives from in-page clicks.
    private handleWindowBlur(): void {
        this.clearBlurSettleTimeout();
        this.blurSettleTimeout = setTimeout(() => {
            this.blurSettleTimeout = null;
            if (!document.hasFocus()) {
                document.body.classList.add(BLUR_CLASS);
            }
        }, BLUR_SETTLE_DELAY_MS);

        this.cmdKeyPressed = false;
        this.shiftKeyPressed = false;
        this.clearWarningTimeout();
    }

    private handleWindowFocus(): void {
        document.body.classList.remove(BLUR_CLASS);
    }

    private handleVisibilityChange(): void {
        if (document.hidden) {
            document.body.classList.add(BLUR_CLASS);
        } else if (document.hasFocus()) {
            document.body.classList.remove(BLUR_CLASS);
        }
    }

    private startScreenshotDetectionTimer(): void {
        this.clearWarningTimeout();

        this.warningTimeout = setTimeout(() => {
            if (this.cmdKeyPressed && this.shiftKeyPressed && !this.otherKeyPressed) {
                this.triggerCallbackThrottled();
            }
        }, SCREENSHOT_DETECTION_DELAY_MS);
    }

    private triggerCallbackThrottled(): void {
        const now = Date.now();
        if (now - this.lastCallbackTime > CALLBACK_THROTTLE_MS) {
            this.lastCallbackTime = now;
            this.callback?.();
        }
    }

    private clearWarningTimeout(): void {
        if (this.warningTimeout) {
            clearTimeout(this.warningTimeout);
            this.warningTimeout = null;
        }
    }

    private clearBlurSettleTimeout(): void {
        if (this.blurSettleTimeout) {
            clearTimeout(this.blurSettleTimeout);
            this.blurSettleTimeout = null;
        }
    }

    private isModifierKey(key: string): boolean {
        return key === 'Meta' || key === 'Shift' || key === 'Control' || key === 'Alt';
    }

    private resetState(): void {
        this.isListenerRegistered = false;
        this.callback = null;
        this.cmdKeyPressed = false;
        this.shiftKeyPressed = false;
        this.otherKeyPressed = false;
        this.lastCallbackTime = 0;
    }
}

export const screenshotDetectionManager = new ScreenshotDetectionManager();
