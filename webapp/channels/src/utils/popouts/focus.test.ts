// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getBasePath} from 'utils/url';
import {isDesktopApp} from 'utils/user_agent';

import {POPOUT_FOCUSED, POPOUT_BLURRED, getFocusedPopoutInfo} from './focus';
import {popoutChannel, popoutThread} from './popout_windows';

jest.mock('utils/desktop_api', () => ({
    __esModule: true,
    default: {
        setupDesktopPopout: jest.fn(),
        sendToParentWindow: jest.fn(),
        onMessageFromParentWindow: jest.fn(),
    },
}));

jest.mock('utils/user_agent', () => ({
    isDesktopApp: jest.fn(),
}));

jest.mock('utils/url', () => ({
    getBasePath: jest.fn(),
}));

jest.mock('./browser_popouts', () => {
    const mockFn = jest.fn();
    (globalThis as typeof globalThis & {mockSetupBrowserPopoutFocus: typeof mockFn}).mockSetupBrowserPopoutFocus = mockFn;
    return {
        __esModule: true,
        default: {
            setupBrowserPopout: mockFn,
        },
    };
});

const getMockSetupBrowserPopout = (): jest.Mock => (globalThis as typeof globalThis & {mockSetupBrowserPopoutFocus: jest.Mock}).mockSetupBrowserPopoutFocus;

function setupBrowser() {
    jest.mocked(isDesktopApp).mockReturnValue(false);
    jest.mocked(getBasePath).mockReturnValue('');
}

describe('popout focus tracking', () => {
    let messageListeners: Array<(channel: string, ...args: unknown[]) => void>;
    let closeListeners: Array<() => void>;

    beforeEach(() => {
        messageListeners = [];
        closeListeners = [];
    });

    function setupWithCapture() {
        setupBrowser();
        getMockSetupBrowserPopout().mockReturnValue({
            sendToPopout: jest.fn(),
            onMessageFromPopout: (listener: (channel: string, ...args: unknown[]) => void) => {
                messageListeners.push(listener);
            },
            onClosePopout: (listener: () => void) => {
                closeListeners.push(listener);
            },
        });
    }

    function simulateMessage(channel: string, ...args: unknown[]) {
        messageListeners.forEach((listener) => listener(channel, ...args));
    }

    it('should track channel focus from popoutChannel', async () => {
        setupWithCapture();
        await popoutChannel('Title', 'test-team', 'channels', 'town-square');

        simulateMessage(POPOUT_FOCUSED, 'channel-123');
        expect(getFocusedPopoutInfo()).toEqual({channelId: 'channel-123', threadId: undefined});

        simulateMessage(POPOUT_BLURRED);
    });

    it('should track thread focus from popoutThread', async () => {
        setupWithCapture();
        await popoutThread('Title', 'thread-456', 'test-team', jest.fn());

        simulateMessage(POPOUT_FOCUSED, 'channel-789', 'thread-456');
        expect(getFocusedPopoutInfo()).toEqual({channelId: 'channel-789', threadId: 'thread-456'});

        simulateMessage(POPOUT_BLURRED);
    });

    it('should clear focus on blur', async () => {
        setupWithCapture();
        await popoutChannel('Title', 'test-team', 'channels', 'town-square');

        simulateMessage(POPOUT_FOCUSED, 'channel-123');
        expect(getFocusedPopoutInfo()).not.toBeNull();

        simulateMessage(POPOUT_BLURRED);
        expect(getFocusedPopoutInfo()).toBeNull();
    });
});
