// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';
import type {Mock} from 'vitest';

import DesktopApp from 'utils/desktop_api';
import {isDesktopApp} from 'utils/user_agent';

import {FOCUS_REPLY_POST, popoutThread} from './popout_windows';

// Mock dependencies
vi.mock('utils/desktop_api', () => ({
    default: {
        setupDesktopPopout: vi.fn(),
        sendToParentWindow: vi.fn(),
        onMessageFromParentWindow: vi.fn(),
    },
}));

vi.mock('utils/user_agent', () => ({
    isDesktopApp: vi.fn(),
}));

vi.mock('./browser_popouts', () => {
    const mockFn = vi.fn();
    (globalThis as typeof globalThis & {mockSetupBrowserPopout: typeof mockFn}).mockSetupBrowserPopout = mockFn;
    return {
        default: {
            setupBrowserPopout: mockFn,
        },
    };
});

const mockDesktopApp = DesktopApp as unknown as {setupDesktopPopout: Mock; sendToParentWindow: Mock; onMessageFromParentWindow: Mock};
const mockIsDesktopApp = isDesktopApp as Mock;

const getMockSetupBrowserPopout = () => {
    return (globalThis as typeof globalThis & {mockSetupBrowserPopout: Mock}).mockSetupBrowserPopout;
};

describe('popout_windows', () => {
    const mockIntl = {
        formatMessage: vi.fn(({id, defaultMessage}) => {
            if (id === 'thread_popout.title') {
                return 'Thread - {channelName} - {teamName}';
            }
            return defaultMessage;
        }),
    } as unknown as IntlShape;

    beforeEach(() => {
        vi.clearAllMocks();
        getMockSetupBrowserPopout().mockClear();
    });

    describe('popoutThread', () => {
        const mockOnFocusPost = vi.fn();

        beforeEach(() => {
            mockOnFocusPost.mockClear();
        });

        it('should call popout with correct path and props for desktop app', async () => {
            mockIsDesktopApp.mockReturnValue(true);
            const mockListeners = {
                sendToPopout: vi.fn(),
                onMessageFromPopout: vi.fn(),
                onClosePopout: vi.fn(),
            };
            mockDesktopApp.setupDesktopPopout.mockResolvedValue(mockListeners);

            await popoutThread(mockIntl, 'thread-123', 'test-team', mockOnFocusPost);

            expect(mockDesktopApp.setupDesktopPopout).toHaveBeenCalledWith(
                '/_popout/thread/test-team/thread-123',
                {
                    isRHS: true,
                    titleTemplate: 'Thread - {channelName} - {teamName}',
                },
            );
        });

        it('should call popout with correct path and props for browser popout', async () => {
            mockIsDesktopApp.mockReturnValue(false);
            const mockListeners = {
                sendToPopout: vi.fn(),
                onMessageFromPopout: vi.fn(),
                onClosePopout: vi.fn(),
            };
            getMockSetupBrowserPopout().mockReturnValue(mockListeners);

            await popoutThread(mockIntl, 'thread-123', 'test-team', mockOnFocusPost);

            expect(getMockSetupBrowserPopout()).toHaveBeenCalledWith(
                '/_popout/thread/test-team/thread-123',
            );
        });

        it('should return popout listeners', async () => {
            mockIsDesktopApp.mockReturnValue(true);
            const mockListeners = {
                sendToPopout: vi.fn(),
                onMessageFromPopout: vi.fn(),
                onClosePopout: vi.fn(),
            };
            mockDesktopApp.setupDesktopPopout.mockResolvedValue(mockListeners);

            const result = await popoutThread(mockIntl, 'thread-123', 'test-team', mockOnFocusPost);

            expect(result).toEqual(mockListeners);
        });

        it('should set up listener for FOCUS_REPLY_POST messages', async () => {
            mockIsDesktopApp.mockReturnValue(true);
            const mockListener = vi.fn();
            const mockListeners = {
                sendToPopout: vi.fn(),
                onMessageFromPopout: mockListener,
                onClosePopout: vi.fn(),
            };
            mockDesktopApp.setupDesktopPopout.mockResolvedValue(mockListeners);

            await popoutThread(mockIntl, 'thread-123', 'test-team', mockOnFocusPost);

            expect(mockListener).toHaveBeenCalledTimes(1);
            const registeredListener = mockListener.mock.calls[0][0];

            registeredListener(FOCUS_REPLY_POST, 'post-123', '/team/pl/post-123');

            expect(mockOnFocusPost).toHaveBeenCalledTimes(1);
            expect(mockOnFocusPost).toHaveBeenCalledWith('post-123', '/team/pl/post-123');
        });
    });
});
