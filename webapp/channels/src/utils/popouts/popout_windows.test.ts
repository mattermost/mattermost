// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import DesktopApp from 'utils/desktop_api';
import {isDesktopApp} from 'utils/user_agent';

import {FOCUS_REPLY_POST, popoutThread} from './popout_windows';

// Mock dependencies
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

jest.mock('./browser_popouts', () => {
    const mockFn = jest.fn();
    (globalThis as typeof globalThis & {mockSetupBrowserPopout: typeof mockFn}).mockSetupBrowserPopout = mockFn;
    return {
        __esModule: true,
        default: {
            setupBrowserPopout: mockFn,
        },
    };
});

const mockDesktopApp = DesktopApp as jest.Mocked<typeof DesktopApp>;
const mockIsDesktopApp = isDesktopApp as jest.MockedFunction<typeof isDesktopApp>;

const getMockSetupBrowserPopout = () => {
    return (globalThis as typeof globalThis & {mockSetupBrowserPopout: jest.MockedFunction<() => unknown>}).mockSetupBrowserPopout;
};

describe('popout_windows', () => {
    const mockIntl = {
        formatMessage: jest.fn(({id, defaultMessage}) => {
            if (id === 'thread_popout.title') {
                return 'Thread - {channelName} - {teamName}';
            }
            return defaultMessage;
        }),
    } as unknown as IntlShape;

    beforeEach(() => {
        jest.clearAllMocks();
        getMockSetupBrowserPopout().mockClear();
    });

    describe('popoutThread', () => {
        const mockOnFocusPost = jest.fn();

        beforeEach(() => {
            mockOnFocusPost.mockClear();
        });

        it('should call popout with correct path and props for desktop app', async () => {
            mockIsDesktopApp.mockReturnValue(true);
            const mockListeners = {
                sendToPopout: jest.fn(),
                onMessageFromPopout: jest.fn(),
                onClosePopout: jest.fn(),
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
                sendToPopout: jest.fn(),
                onMessageFromPopout: jest.fn(),
                onClosePopout: jest.fn(),
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
                sendToPopout: jest.fn(),
                onMessageFromPopout: jest.fn(),
                onClosePopout: jest.fn(),
            };
            mockDesktopApp.setupDesktopPopout.mockResolvedValue(mockListeners);

            const result = await popoutThread(mockIntl, 'thread-123', 'test-team', mockOnFocusPost);

            expect(result).toEqual(mockListeners);
        });

        it('should set up listener for FOCUS_REPLY_POST messages', async () => {
            mockIsDesktopApp.mockReturnValue(true);
            const mockListener = jest.fn();
            const mockListeners = {
                sendToPopout: jest.fn(),
                onMessageFromPopout: mockListener,
                onClosePopout: jest.fn(),
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

