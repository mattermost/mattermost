// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RouteComponentProps} from 'react-router-dom';
import {bindActionCreators} from 'redux';

import {ServiceEnvironment} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import * as GlobalActions from 'actions/global_actions';

import testConfigureStore from 'packages/mattermost-redux/test/test_store';
import {renderWithContext, waitFor} from 'tests/react_testing_utils';
import {StoragePrefixes} from 'utils/constants';
import * as Utils from 'utils/utils';

import {handleLoginLogoutSignal, redirectToOnboardingOrDefaultTeam} from './actions';
import type {Props} from './root';
import Root, {doesRouteBelongToTeamControllerRoutes} from './root';

jest.mock('utils/rudder', () => ({
    rudderAnalytics: {
        identify: jest.fn(),
        load: jest.fn(),
        page: jest.fn(),
        ready: jest.fn((callback) => callback()), // Default behavior: calls the callback
        track: jest.fn(),
    },
    RudderTelemetryHandler: jest.fn(),
}));

jest.mock('rudder-sdk-js', () => {
    return {
        identify: jest.fn(),
        load: jest.fn(),
        page: jest.fn(),
        ready: jest.fn((callback) => callback()),
    };
});

jest.mock('actions/telemetry_actions');

jest.mock('components/announcement_bar', () => () => <div/>);
jest.mock('components/team_sidebar', () => () => <div/>);
jest.mock('components/mobile_view_watcher', () => () => <div/>);
jest.mock('./performance_reporter_controller', () => () => <div/>);

jest.mock('utils/utils', () => ({
    applyTheme: jest.fn(),
}));

jest.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: jest.fn(),
}));

jest.mock('mattermost-redux/actions/general', () => ({
    getFirstAdminSetupComplete: jest.fn(() => Promise.resolve({
        type: 'FIRST_ADMIN_COMPLETE_SETUP_RECEIVED',
        data: true,
    })),
    setUrl: () => {},
}));

describe('components/Root', () => {
    const store = testConfigureStore();

    const baseProps: Props = {
        theme: {sidebarBg: 'color'} as Theme,
        isConfigLoaded: true,
        telemetryEnabled: true,
        noAccounts: false,
        telemetryId: '1234ab',
        serviceEnvironment: undefined,
        siteURL: 'http://localhost:8065',
        iosDownloadLink: undefined,
        androidDownloadLink: undefined,
        appDownloadLink: undefined,
        showTermsOfService: false,
        plugins: [],
        products: [],
        showLaunchingWorkspace: false,
        rhsIsExpanded: false,
        rhsIsOpen: false,
        rhsState: null,
        shouldShowAppBar: false,
        isCloud: false,
        enableDesktopLandingPage: true,
        actions: {
            loadConfigAndMe: jest.fn().mockImplementation(() => {
                return Promise.resolve({
                    isLoaded: true,
                    isMeRequested: false,
                });
            }),
            getFirstAdminSetupComplete: jest.fn(),
            getProfiles: jest.fn(),
            loadRecentlyUsedCustomEmojis: jest.fn(),
            migrateRecentEmojis: jest.fn(),
            registerCustomPostRenderer: jest.fn(),
            initializeProducts: jest.fn(),
            ...bindActionCreators({
                handleLoginLogoutSignal,
                redirectToOnboardingOrDefaultTeam,
            }, store.dispatch),
        },
        permalinkRedirectTeamName: 'myTeam',
        ...{
            location: {
                pathname: '/',
            },
            history: {
                push: jest.fn(),
            } as unknown as RouteComponentProps['history'],
        } as RouteComponentProps,
        isDevModeEnabled: false,
    };

    let originalMatchMedia: (query: string) => MediaQueryList;
    let originalReload: () => void;

    beforeAll(() => {
        originalMatchMedia = window.matchMedia;
        originalReload = window.location.reload;

        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn().mockImplementation((query) => ({
                matches: false,
                media: query,
            })),
        });

        Object.defineProperty(window.location, 'reload', {
            configurable: true,
            writable: true,
        });

        window.location.reload = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(() => {
        window.matchMedia = originalMatchMedia;
        window.location.reload = originalReload;
    });

    test('should load config and license on mount and redirect to sign-up page', async () => {
        const props = {
            ...baseProps,
            noAccounts: true,
        };

        renderWithContext(<Root {...props}/>);

        await waitFor(() => {
            expect(props.history.push).toHaveBeenCalledWith('/signup_user_complete');
        });
    });

    test('should load user, config, and license on mount and redirect to defaultTeam on success', async () => {
        document.cookie = 'MMUSERID=userid';
        localStorage.setItem('was_logged_in', 'true');

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                loadConfigAndMe: jest.fn().mockImplementation(() => {
                    return Promise.resolve({
                        isLoaded: true,
                        isMeRequested: true,
                    });
                }),
            },
        };

        renderWithContext(<Root {...props}/>);

        await waitFor(() => {
            expect(props.actions.loadConfigAndMe).toHaveBeenCalledTimes(1);
            expect(GlobalActions.redirectUserToDefaultTeam).toHaveBeenCalledTimes(1);
        });
    });

    test('should load user, config, and license on mount and should not redirect to defaultTeam id pathname is not root', async () => {
        document.cookie = 'MMUSERID=userid';
        localStorage.setItem('was_logged_in', 'true');

        const props = {
            ...baseProps,
            location: {
                pathname: '/admin_console',
            } as RouteComponentProps['location'],
            actions: {
                ...baseProps.actions,
                loadConfigAndMe: jest.fn().mockImplementation(() => {
                    return Promise.resolve({
                        isLoaded: true,
                        isMeRequested: true,
                    });
                }),
            },
        };

        renderWithContext(<Root {...props}/>);

        await waitFor(() => {
            expect(props.actions.loadConfigAndMe).toHaveBeenCalledTimes(1);
            expect(GlobalActions.redirectUserToDefaultTeam).not.toHaveBeenCalled();
        });
    });

    test('should call history on props change', () => {
        const props = {
            ...baseProps,
            noAccounts: false,
            history: {
                push: jest.fn(),
            } as unknown as RouteComponentProps['history'],
        };

        const {rerender} = renderWithContext(<Root {...props}/>);

        expect(props.history.push).not.toHaveBeenCalled();

        const props2 = {
            ...props,
            noAccounts: true,
        };

        rerender(<Root {...props2}/>);

        expect(props.history.push).toHaveBeenLastCalledWith('/signup_user_complete');
    });

    test('should reload on focus after getting signal login event from another tab', () => {
        renderWithContext(<Root {...baseProps}/>);

        const loginSignal = new StorageEvent('storage', {
            key: StoragePrefixes.LOGIN,
            newValue: String(Math.random()),
            storageArea: localStorage,
        });

        window.dispatchEvent(loginSignal);
        window.dispatchEvent(new Event('focus'));

        expect(window.location.reload).toBeCalledTimes(1);
    });

    test('should not set a TelemetryHandler when onConfigLoaded is called if Rudder is not configured', async () => {
        const props = {
            ...baseProps,
            serviceEnvironment: ServiceEnvironment.DEV,
            actions: {
                ...baseProps.actions,
                loadConfigAndMe: jest.fn().mockImplementation(() => {
                    return Promise.resolve({
                        isLoaded: true,
                        isMeRequested: true,
                    });
                }),
            },
        };

        renderWithContext(<Root {...props}/>);

        // Wait for the component to load config and call onConfigLoaded
        await waitFor(() => {
            expect(props.actions.loadConfigAndMe).toHaveBeenCalledTimes(1);
        });

        Client4.trackEvent('category', 'event');

        expect(Client4.telemetryHandler).not.toBeDefined();
    });

    test('should set a TelemetryHandler when onConfigLoaded is called if Rudder is configured', async () => {
        const props = {
            ...baseProps,
            isConfigLoaded: false,
            serviceEnvironment: ServiceEnvironment.TEST,
            actions: {
                ...baseProps.actions,
                loadConfigAndMe: jest.fn().mockImplementation(() => {
                    return Promise.resolve({
                        isLoaded: true,
                        isMeRequested: true,
                    });
                }),
            },
        };

        const {rerender} = renderWithContext(<Root {...props}/>);

        // Wait for the component to load config and call onConfigLoaded
        await waitFor(() => {
            expect(props.actions.loadConfigAndMe).toHaveBeenCalledTimes(1);
        });

        const props2 = {
            ...props,
            isConfigLoaded: true,
        };

        rerender(<Root {...props2}/>);

        expect(Client4.telemetryHandler).toBeDefined();
    });

    describe('showLandingPageIfNecessary', () => {
        const landingProps = {
            ...baseProps,
            iosDownloadLink: 'http://iosapp.com',
            androidDownloadLink: 'http://androidapp.com',
            appDownloadLink: 'http://desktopapp.com',
            ...{
                location: {
                    pathname: '/',
                    search: '',
                },
            } as RouteComponentProps,
        };

        test('should show for normal cases', async () => {
            renderWithContext(<Root {...landingProps}/>);

            await waitFor(() => {
                expect(landingProps.history.push).toHaveBeenCalledWith('/landing#/');
            });
        });

        test('should not show for Desktop App login flow', async () => {
            const props = {
                ...landingProps,
                ...{
                    location: {
                        pathname: '/login/desktop',
                    },
                } as RouteComponentProps,
            };

            renderWithContext(<Root {...props}/>);

            await waitFor(() => {
                expect(props.history.push).not.toHaveBeenCalled();
            });
        });

        test('should not show when disabled', async () => {
            const props = {
                ...landingProps,
                enableDesktopLandingPage: false,
            };

            renderWithContext(<Root {...props}/>);

            await waitFor(() => {
                expect(props.history.push).not.toHaveBeenCalled();
            });
        });
    });

    describe('applyTheme', () => {
        test('should apply theme initially and on change', async () => {
            const props = {
                ...baseProps,
            };

            const {rerender} = renderWithContext(<Root {...props}/>);

            await waitFor(() => {
                expect(Utils.applyTheme).toHaveBeenCalledWith(props.theme);
            });

            const props2 = {
                ...props,
                theme: {sidebarBg: 'color2'} as Theme,
            };

            rerender(<Root {...props2}/>);

            expect(Utils.applyTheme).toHaveBeenCalledWith(props2.theme);
        });

        test('should not apply theme in system console', async () => {
            const props = {
                ...baseProps,
                ...{
                    location: {
                        pathname: '/admin_console',
                    },
                } as RouteComponentProps,
            };

            const {rerender} = renderWithContext(<Root {...props}/>);

            const props2 = {
                ...props,
                theme: {sidebarBg: 'color2'} as Theme,
            };

            rerender(<Root {...props2}/>);

            expect(Utils.applyTheme).not.toHaveBeenCalled();
        });
    });
});

describe('doesRouteBelongToTeamControllerRoutes', () => {
    test('should return true for some of team_controller routes', () => {
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/messages/abc')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/messages')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/channels/cde')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/channels')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/threads/efg')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/threads')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/drafts')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/integrations/klm')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/emoji/nop')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/integrations')).toBe(true);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_1/emoji')).toBe(true);
    });

    test('should return false for other of team_controller routes', () => {
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_2')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_2/pl/permalink123')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/team_name_example_2/needs_team_component_plugin')).toBe(false);
    });

    test('should return false for other routes of root', () => {
        expect(doesRouteBelongToTeamControllerRoutes('/plug/custom_route_component')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/main_component_product_1')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/product_1/public')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/_redirect/pl/message_1')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/preparing-workspace')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/mfa')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/create_team')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/oauth/authorize')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/select_team')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/landing')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/terms_of_service')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/claim')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/do_verify_email')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/should_verify_email')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/signup_user_complete')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/reset_password_complete')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/reset_password')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/access_problem')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/login')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/error')).toBe(false);
    });

    test('should return false for admin_console routes', () => {
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/about')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/reporting')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/user_management')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/environment')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/site_config')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/plugins/')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/integrations/')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/integrations/bot_accounts')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/compliance')).toBe(false);
        expect(doesRouteBelongToTeamControllerRoutes('/admin_console/experimental')).toBe(false);
    });
});
