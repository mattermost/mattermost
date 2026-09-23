// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-require-imports */

// The setupFilesAfterEnv global mock for utils/browser_history replaces the whole
// module with a stub. Unmock it here so we load the real module and can verify its
// side effects (onBrowserHistoryPush registration and the window flag guard).
jest.unmock('utils/browser_history');

jest.mock('history', () => ({
    createBrowserHistory: () => ({
        action: 'POP',
        push: jest.fn(),
        replace: jest.fn(),
        go: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        listen: jest.fn(),
        block: jest.fn(),
        get location() {
            return {};
        },
    }),
}));

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(),
    getDesktopVersion: jest.fn().mockReturnValue('5.0.0'),
}));

jest.mock('utils/server_version', () => ({
    isServerVersionGreaterThanOrEqualTo: jest.fn().mockReturnValue(true),
}));

jest.mock('module_registry', () => ({
    getModule: jest.fn().mockReturnValue(undefined),
}));

jest.mock('utils/desktop_api', () => ({
    __esModule: true,
    default: {
        onBrowserHistoryPush: jest.fn(),
        doBrowserHistoryPush: jest.fn(),
    },
}));

describe('browser_history', () => {
    beforeEach(() => {
        jest.resetModules();
        delete (window as Window & {__mmBrowserHistoryPushRegistered?: boolean}).__mmBrowserHistoryPushRegistered;
    });

    describe('onBrowserHistoryPush registration', () => {
        it('is skipped when not running in the desktop app', () => {
            require('@mattermost/shared/utils/user_agent').isDesktopApp.mockReturnValue(false);

            require('utils/browser_history');

            const {default: DesktopApp} = require('utils/desktop_api');
            expect(DesktopApp.onBrowserHistoryPush).not.toHaveBeenCalled();
            expect(window.__mmBrowserHistoryPushRegistered).toBeUndefined();
        });

        it('registers the listener and sets the window flag on the first desktop load', () => {
            require('@mattermost/shared/utils/user_agent').isDesktopApp.mockReturnValue(true);

            require('utils/browser_history');

            const {default: DesktopApp} = require('utils/desktop_api');
            expect(DesktopApp.onBrowserHistoryPush).toHaveBeenCalledTimes(1);
            expect(window.__mmBrowserHistoryPushRegistered).toBe(true);
        });

        it('does not register a second listener when the window flag is already set', () => {
            // Pre-set the flag to simulate the core web app having already loaded
            // browser_history and registered the listener. A plugin bundling its own
            // copy of this module would encounter this state on its own load.
            (window as Window & {__mmBrowserHistoryPushRegistered?: boolean}).__mmBrowserHistoryPushRegistered = true;
            require('@mattermost/shared/utils/user_agent').isDesktopApp.mockReturnValue(true);

            require('utils/browser_history');

            const {default: DesktopApp} = require('utils/desktop_api');
            expect(DesktopApp.onBrowserHistoryPush).not.toHaveBeenCalled();
        });
    });
});
