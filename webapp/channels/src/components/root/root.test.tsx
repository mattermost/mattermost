// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RouteComponentProps} from 'react-router-dom';
import {bindActionCreators} from 'redux';

import {ServiceEnvironment} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import * as GlobalActions from 'actions/global_actions';
import {handleLoginLogoutSignal, redirectToOnboardingOrDefaultTeam} from 'actions/views/root';

import Root, {type Props} from 'components/root/root';

import testConfigureStore from 'packages/mattermost-redux/test/test_store';
import {renderWithContext, waitFor} from 'tests/react_testing_utils';
import {StoragePrefixes} from 'utils/constants';

jest.mock('mattermost-redux/client/rudder', () => ({
    rudderAnalytics: {
        identify: jest.fn(),
        load: jest.fn(),
        page: jest.fn(),
        ready: jest.fn((callback) => callback()), // Default behavior: calls the callback
        track: jest.fn(),
    },
    RudderTelemetryHandler: jest.fn(),
}));

jest.mock('mattermost-redux/client/rudder', () => {
    const actual = jest.requireActual('mattermost-redux/client/rudder');
    return {
        ...actual,
        rudderAnalytics: {
            ...actual.rudderAnalytics,
            ready: jest.fn((callback) => callback()),
        },
    };
});

jest.mock('actions/telemetry_actions');

jest.mock('components/announcement_bar', () => () => <div/>);
jest.mock('components/team_sidebar', () => () => <div/>);
jest.mock('components/mobile_view_watcher', () => () => <div/>);
jest.mock('./performance_reporter_controller', () => () => <div/>);

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');

    return {
        ...original,
        applyTheme: jest.fn(),
    };
});

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
        theme: {} as Theme,
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
    });
});
