// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import DesktopApp from 'utils/desktop_api';
import {isDesktopApp} from 'utils/user_agent';

import {popoutThread} from './popout_windows';

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

const mockDesktopApp = DesktopApp as jest.Mocked<typeof DesktopApp>;
const mockIsDesktopApp = isDesktopApp as jest.MockedFunction<typeof isDesktopApp>;

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
    });

    describe('popoutThread', () => {
        it('should call popout with correct path and props', async () => {
            mockIsDesktopApp.mockReturnValue(true);
            await popoutThread(mockIntl, 'thread-123', 'test-team');

            expect(mockDesktopApp.setupDesktopPopout).toHaveBeenCalledWith(
                '/_popout/thread/test-team/thread-123',
                {
                    isRHS: true,
                    titleTemplate: 'Thread - {channelName} - {teamName}',
                },
            );
        });

        it('should handle desktop app popout', async () => {
            mockIsDesktopApp.mockReturnValue(true);
            const mockListeners = {
                sendToPopout: jest.fn(),
                onMessageFromPopout: jest.fn(),
                onClosePopout: jest.fn(),
            };
            mockDesktopApp.setupDesktopPopout.mockResolvedValue(mockListeners);

            const result = await popoutThread(mockIntl, 'thread-123', 'test-team');

            expect(result).toEqual(mockListeners);
        });
    });
});

