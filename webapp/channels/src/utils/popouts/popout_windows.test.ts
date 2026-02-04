// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import DesktopApp from 'utils/desktop_api';
import {getBasePath} from 'utils/url';
import {isDesktopApp} from 'utils/user_agent';

import {FOCUS_REPLY_POST, popoutRhsPlugin, popoutThread} from './popout_windows';

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

jest.mock('utils/url', () => ({
    getBasePath: jest.fn(),
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
const mockGetBasePath = getBasePath as jest.MockedFunction<typeof getBasePath>;

const getMockSetupBrowserPopout = () => {
    return (globalThis as typeof globalThis & {mockSetupBrowserPopout: jest.MockedFunction<() => unknown>}).mockSetupBrowserPopout;
};

describe('popout_windows', () => {
    beforeEach(() => {
        getMockSetupBrowserPopout().mockClear();

        // Default: no subpath
        mockGetBasePath.mockReturnValue('');
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

            await popoutThread('Thread - {channelName} - {teamName} - {serverName}', 'thread-123', 'test-team', mockOnFocusPost);

            expect(mockDesktopApp.setupDesktopPopout).toHaveBeenCalledWith(
                '/_popout/thread/test-team/thread-123',
                {
                    isRHS: true,
                    titleTemplate: 'Thread - {channelName} - {teamName} - {serverName}',
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

            await popoutThread('Thread - {channelName} - {teamName} - {serverName}', 'thread-123', 'test-team', mockOnFocusPost);

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

            const result = await popoutThread('Thread - {channelName} - {teamName} - {serverName}', 'thread-123', 'test-team', mockOnFocusPost);

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

            await popoutThread('Thread - {channelName} - {teamName} - {serverName}', 'thread-123', 'test-team', mockOnFocusPost);

            expect(mockListener).toHaveBeenCalledTimes(1);
            const registeredListener = mockListener.mock.calls[0][0];

            registeredListener(FOCUS_REPLY_POST, 'post-123', '/team/pl/post-123');

            expect(mockOnFocusPost).toHaveBeenCalledTimes(1);
            expect(mockOnFocusPost).toHaveBeenCalledWith('post-123', '/team/pl/post-123');
        });

        it('should include subpath in popout URL when basename is set', async () => {
            mockIsDesktopApp.mockReturnValue(false);
            mockGetBasePath.mockReturnValue('/company/mattermost');
            const mockListeners = {
                sendToPopout: jest.fn(),
                onMessageFromPopout: jest.fn(),
                onClosePopout: jest.fn(),
            };
            getMockSetupBrowserPopout().mockReturnValue(mockListeners);

            await popoutThread('Thread - {channelName} - {teamName} - {serverName}', 'thread-123', 'test-team', mockOnFocusPost);

            expect(getMockSetupBrowserPopout()).toHaveBeenCalledWith(
                '/company/mattermost/_popout/thread/test-team/thread-123',
            );
        });
    });

    describe('popoutRhsPlugin', () => {
        it('should call popout with correct path and props for desktop app', async () => {
            mockIsDesktopApp.mockReturnValue(true);
            const mockListeners = {
                sendToPopout: jest.fn(),
                onMessageFromPopout: jest.fn(),
                onClosePopout: jest.fn(),
            };
            mockDesktopApp.setupDesktopPopout.mockResolvedValue(mockListeners);

            await popoutRhsPlugin('{pluginDisplayName} - {serverName}', 'test-plugin-id', 'test-team', 'test-channel');

            expect(mockDesktopApp.setupDesktopPopout).toHaveBeenCalledWith(
                '/_popout/rhs/test-team/test-channel/plugin/test-plugin-id',
                {
                    isRHS: true,
                    titleTemplate: '{pluginDisplayName} - {serverName}',
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

            await popoutRhsPlugin('{pluginDisplayName} - {serverName}', 'test-plugin-id', 'test-team', 'test-channel');

            expect(getMockSetupBrowserPopout()).toHaveBeenCalledWith(
                '/_popout/rhs/test-team/test-channel/plugin/test-plugin-id',
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

            const result = await popoutRhsPlugin('{pluginDisplayName} - {serverName}', 'test-plugin-id', 'test-team', 'test-channel');

            expect(result).toEqual(mockListeners);
        });

        it('should include subpath in popout URL when basename is set', async () => {
            mockIsDesktopApp.mockReturnValue(false);
            mockGetBasePath.mockReturnValue('/company/mattermost');
            const mockListeners = {
                sendToPopout: jest.fn(),
                onMessageFromPopout: jest.fn(),
                onClosePopout: jest.fn(),
            };
            getMockSetupBrowserPopout().mockReturnValue(mockListeners);

            await popoutRhsPlugin('{pluginDisplayName} - {serverName}', 'test-plugin-id', 'test-team', 'test-channel');

            expect(getMockSetupBrowserPopout()).toHaveBeenCalledWith(
                '/company/mattermost/_popout/rhs/test-team/test-channel/plugin/test-plugin-id',
            );
        });
    });
});

