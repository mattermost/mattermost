// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RouteComponentProps} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import rudderAnalytics from 'rudder-sdk-js';

import {ServiceEnvironment} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import * as GlobalActions from 'actions/global_actions';

import Root from 'components/root/root';

import testConfigureStore from 'packages/mattermost-redux/test/test_store';
import {renderWithContext, waitFor} from 'tests/react_testing_utils';
import {StoragePrefixes} from 'utils/constants';

import {handleLoginLogoutSignal, redirectToOnboardingOrDefaultTeam} from './actions';

jest.mock('rudder-sdk-js', () => ({
    identify: jest.fn(),
    load: jest.fn(),
    page: jest.fn(),
    ready: jest.fn((callback) => callback()),
    track: jest.fn(),
}));
jest.mock('actions/telemetry_actions');
jest.mock('components/announcement_bar', () => () => <div/>);
jest.mock('components/team_sidebar', () => () => <div/>);
jest.mock('components/mobile_view_watcher', () => () => <div/>);
jest.mock('./performance_reporter_controller', () => () => <div/>);
jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        localizeMessage: () => {},
        applyTheme: jest.fn(),
        makeIsEligibleForClick: jest.fn(),
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
    let originalMatchMedia: (query: string) => MediaQueryList;
    let originalReload: () => void;

    const baseProps = {
        telemetryEnabled: true,
        telemetryId: '1234ab',
        noAccounts: false,
        showTermsOfService: false,
        theme: {} as Theme,
        actions: {
            loadConfigAndMe: jest.fn().mockImplementation(() => {
                return Promise.resolve({
                    config: {},
                    isMeLoaded: false,
                });
            }),
            getProfiles: jest.fn(),
            loadRecentlyUsedCustomEmojis: jest.fn(),
            migrateRecentEmojis: jest.fn(),
            savePreferences: jest.fn(),
            registerCustomPostRenderer: jest.fn(),
            initializeProducts: jest.fn(),
            ...bindActionCreators({
                handleLoginLogoutSignal,
                redirectToOnboardingOrDefaultTeam,
            }, store.dispatch),
        },
        permalinkRedirectTeamName: 'myTeam',
        showLaunchingWorkspace: false,
        plugins: [],
        products: [],
        ...{
            location: {
                pathname: '/',
            },
        } as RouteComponentProps,
        isCloud: false,
        rhsIsExpanded: false,
        rhsIsOpen: false,
        shouldShowAppBar: false,
    };

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

    afterAll(() => {
        window.matchMedia = originalMatchMedia;
        window.location.reload = originalReload;
    });

    test('should load config and license on mount and redirect to sign-up page', async () => {
        const props = {
            ...baseProps,
            noAccounts: true,
            history: {
                push: jest.fn(),
            } as unknown as RouteComponentProps['history'],
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
                        config: {},
                        isMeLoaded: true,
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
                        config: {},
                        isMeLoaded: true,
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

        Object.defineProperty(window.location, 'reload', {
            configurable: true,
            writable: true,
        });
        window.location.reload = jest.fn();

        const loginSignal = new StorageEvent('storage', {
            key: StoragePrefixes.LOGIN,
            newValue: String(Math.random()),
            storageArea: localStorage,
        });

        window.dispatchEvent(loginSignal);
        window.dispatchEvent(new Event('focus'));

        expect(window.location.reload).toBeCalledTimes(1);
    });

    describe('onConfigLoaded', () => {
        afterEach(() => {
            Client4.telemetryHandler = undefined;
        });

        test('should not set a TelemetryHandler when onConfigLoaded is called if Rudder is not configured', async () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    loadConfigAndMe: jest.fn().mockImplementation(() => {
                        return Promise.resolve({
                            config: {ServiceEnvironment: ServiceEnvironment.DEV},
                            isMeLoaded: true,
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
                actions: {
                    ...baseProps.actions,
                    loadConfigAndMe: jest.fn().mockImplementation(() => {
                        return Promise.resolve({
                            config: {ServiceEnvironment: ServiceEnvironment.TEST},
                            isMeLoaded: true,
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

            expect(Client4.telemetryHandler).toBeDefined();
        });

        test('should not set a TelemetryHandler when onConfigLoaded is called but Rudder has been blocked', async () => {
            (rudderAnalytics.ready as any).mockImplementation(() => {
                // Simulate an error occurring and the callback not getting called
            });

            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    loadConfigAndMe: jest.fn().mockImplementation(() => {
                        return Promise.resolve({
                            config: {ServiceEnvironment: ServiceEnvironment.PRODUCTION},
                            isMeLoaded: true,
                        });
                    }),
                },
            };

            renderWithContext(<Root {...props}/>);

            await waitFor(() => {
                expect(props.actions.loadConfigAndMe).toHaveBeenCalledTimes(1);
            });

            Client4.trackEvent('category', 'event');

            expect(Client4.telemetryHandler).not.toBeDefined();
        });
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
            history: {
                push: jest.fn(),
            } as unknown as RouteComponentProps['history'],
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
