// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {RouteComponentProps} from 'react-router-dom';

import {shallow} from 'enzyme';
import rudderAnalytics from 'rudder-sdk-js';

import {ServiceEnvironment} from '@mattermost/types/config';

import {GeneralTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import * as GlobalActions from 'actions/global_actions';
import store from 'stores/redux_store.jsx';

import Root from 'components/root/root';

import matchMedia from 'tests/helpers/match_media.mock';
import type {ProductComponent} from 'types/store/plugins';
import Constants, {StoragePrefixes, WindowSizes} from 'utils/constants';

jest.mock('rudder-sdk-js', () => ({
    identify: jest.fn(),
    load: jest.fn(),
    page: jest.fn(),
    ready: jest.fn((callback) => callback()),
    track: jest.fn(),
}));

jest.mock('actions/telemetry_actions');

jest.mock('actions/global_actions', () => ({
    redirectUserToDefaultTeam: jest.fn(),
}));

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');

    return {
        ...original,
        localizeMessage: () => {},
        applyTheme: jest.fn(),
        makeIsEligibleForClick: jest.fn(),

    };
});

jest.mock('mattermost-redux/actions/general', () => ({
    setUrl: () => {},
}));

describe('components/Root', () => {
    const baseProps = {
        telemetryEnabled: true,
        telemetryId: '1234ab',
        noAccounts: false,
        showTermsOfService: false,
        theme: {} as Theme,
        actions: {
            loadConfigAndMe: jest.fn().mockImplementation(() => {
                return Promise.resolve({
                    data: false,
                });
            }),
            emitBrowserWindowResized: () => {},
            getFirstAdminSetupComplete: jest.fn(() => Promise.resolve({
                type: GeneralTypes.FIRST_ADMIN_COMPLETE_SETUP_RECEIVED,
                data: true,
            })),
            getProfiles: jest.fn(),
            migrateRecentEmojis: jest.fn(),
            savePreferences: jest.fn(),
            registerCustomPostRenderer: jest.fn(),
            initializeProducts: jest.fn(),
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

    test('should load config and license on mount and redirect to sign-up page', () => {
        const props = {
            ...baseProps,
            noAccounts: true,
            history: {
                push: jest.fn(),
            } as unknown as RouteComponentProps['history'],
        };

        const wrapper = shallow(<Root {...props}/>);

        (wrapper.instance() as any).onConfigLoaded();
        expect(props.history.push).toHaveBeenCalledWith('/signup_user_complete');
        wrapper.unmount();
    });

    test('should load user, config, and license on mount and redirect to defaultTeam on success', (done) => {
        document.cookie = 'MMUSERID=userid';
        localStorage.setItem('was_logged_in', 'true');

        const props = {
            ...baseProps,
            actions: {
                ...baseProps.actions,
                loadConfigAndMe: jest.fn().mockImplementation(() => {
                    return Promise.resolve({data: true});
                }),
            },
        };

        // Mock the method by extending the class because we don't have a chance to do it before shallow mounts the component
        class MockedRoot extends Root {
            onConfigLoaded = jest.fn(() => {
                expect(this.onConfigLoaded).toHaveBeenCalledTimes(1);
                expect(GlobalActions.redirectUserToDefaultTeam).toHaveBeenCalledTimes(1);
                expect(props.actions.loadConfigAndMe).toHaveBeenCalledTimes(1);
                done();
            });
        }

        const wrapper = shallow(<MockedRoot {...props}/>);
        wrapper.unmount();
    });

    test('should load user, config, and license on mount and should not redirect to defaultTeam id pathname is not root', (done) => {
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
                    return Promise.resolve({data: true});
                }),
            },
        };

        // Mock the method by extending the class because we don't have a chance to do it before shallow mounts the component
        class MockedRoot extends Root {
            onConfigLoaded = jest.fn(() => {
                expect(this.onConfigLoaded).toHaveBeenCalledTimes(1);
                expect(GlobalActions.redirectUserToDefaultTeam).not.toHaveBeenCalled();
                expect(props.actions.loadConfigAndMe).toHaveBeenCalledTimes(1);
                done();
            });
        }

        const wrapper = shallow(<MockedRoot {...props}/>);
        wrapper.unmount();
    });

    test('should call history on props change', () => {
        const props = {
            ...baseProps,
            noAccounts: false,
            history: {
                push: jest.fn(),
            } as unknown as RouteComponentProps['history'],
        };
        const wrapper = shallow(<Root {...props}/>);
        expect(props.history.push).not.toHaveBeenCalled();
        const props2 = {
            noAccounts: true,
        };
        wrapper.setProps(props2);
        expect(props.history.push).toHaveBeenLastCalledWith('/signup_user_complete');
        wrapper.unmount();
    });

    test('should reload on focus after getting signal login event from another tab', () => {
        Object.defineProperty(window.location, 'reload', {
            configurable: true,
            writable: true,
        });
        window.location.reload = jest.fn();
        const wrapper = shallow(<Root {...baseProps}/>);
        const loginSignal = new StorageEvent('storage', {
            key: StoragePrefixes.LOGIN,
            newValue: String(Math.random()),
            storageArea: localStorage,
        });

        window.dispatchEvent(loginSignal);
        window.dispatchEvent(new Event('focus'));
        expect(window.location.reload).toBeCalledTimes(1);
        wrapper.unmount();
    });

    describe('onConfigLoaded', () => {
        afterEach(() => {
            Client4.telemetryHandler = undefined;
        });

        test('should not set a TelemetryHandler when onConfigLoaded is called if Rudder is not configured', () => {
            store.dispatch({
                type: GeneralTypes.CLIENT_CONFIG_RECEIVED,
                data: {
                    ServiceEnvironment: ServiceEnvironment.DEV,
                },
            });

            const wrapper = shallow(<Root {...baseProps}/>);

            Client4.trackEvent('category', 'event');

            expect(Client4.telemetryHandler).not.toBeDefined();

            wrapper.unmount();
        });

        test('should set a TelemetryHandler when onConfigLoaded is called if Rudder is configured', () => {
            store.dispatch({
                type: GeneralTypes.CLIENT_CONFIG_RECEIVED,
                data: {
                    ServiceEnvironment: ServiceEnvironment.TEST,
                },
            });

            const wrapper = shallow(<Root {...baseProps}/>);

            (wrapper.instance() as any).onConfigLoaded();

            Client4.trackEvent('category', 'event');

            expect(Client4.telemetryHandler).toBeDefined();

            wrapper.unmount();
        });

        test('should not set a TelemetryHandler when onConfigLoaded is called but Rudder has been blocked', () => {
            (rudderAnalytics.ready as any).mockImplementation(() => {
                // Simulate an error occurring and the callback not getting called
            });

            store.dispatch({
                type: GeneralTypes.CLIENT_CONFIG_RECEIVED,
                data: {
                    ServiceEnvironment: ServiceEnvironment.TEST,
                },
            });

            const wrapper = shallow(<Root {...baseProps}/>);

            (wrapper.instance() as any).onConfigLoaded();

            Client4.trackEvent('category', 'event');

            expect(Client4.telemetryHandler).not.toBeDefined();

            wrapper.unmount();
        });
    });

    describe('window.matchMedia', () => {
        afterEach(() => {
            matchMedia.clear();
        });

        test('should update redux when the desktop media query matches', () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    emitBrowserWindowResized: jest.fn(),
                },
            };
            const wrapper = shallow(<Root {...props}/>);

            matchMedia.useMediaQuery(`(min-width: ${Constants.DESKTOP_SCREEN_WIDTH + 1}px)`);

            expect(props.actions.emitBrowserWindowResized).toBeCalledTimes(1);

            expect(props.actions.emitBrowserWindowResized.mock.calls[0][0]).toBe(WindowSizes.DESKTOP_VIEW);

            wrapper.unmount();
        });

        test('should update redux when the small desktop media query matches', () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    emitBrowserWindowResized: jest.fn(),
                },
            };
            const wrapper = shallow(<Root {...props}/>);

            matchMedia.useMediaQuery(`(min-width: ${Constants.TABLET_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.DESKTOP_SCREEN_WIDTH}px)`);

            expect(props.actions.emitBrowserWindowResized).toBeCalledTimes(1);

            expect(props.actions.emitBrowserWindowResized.mock.calls[0][0]).toBe(WindowSizes.SMALL_DESKTOP_VIEW);

            wrapper.unmount();
        });

        test('should update redux when the tablet media query matches', () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    emitBrowserWindowResized: jest.fn(),
                },
            };
            const wrapper = shallow(<Root {...props}/>);

            matchMedia.useMediaQuery(`(min-width: ${Constants.MOBILE_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.TABLET_SCREEN_WIDTH}px)`);

            expect(props.actions.emitBrowserWindowResized).toBeCalledTimes(1);

            expect(props.actions.emitBrowserWindowResized.mock.calls[0][0]).toBe(WindowSizes.TABLET_VIEW);

            wrapper.unmount();
        });

        test('should update redux when the mobile media query matches', () => {
            const props = {
                ...baseProps,
                actions: {
                    ...baseProps.actions,
                    emitBrowserWindowResized: jest.fn(),
                },
            };
            const wrapper = shallow(<Root {...props}/>);

            matchMedia.useMediaQuery(`(max-width: ${Constants.MOBILE_SCREEN_WIDTH}px)`);

            expect(props.actions.emitBrowserWindowResized).toBeCalledTimes(1);

            expect(props.actions.emitBrowserWindowResized.mock.calls[0][0]).toBe(WindowSizes.MOBILE_VIEW);

            wrapper.unmount();
        });
    });

    describe('Routes', () => {
        test('Should mount public product routes', () => {
            const mainComponent = () => (<p>{'TestMainComponent'}</p>);
            const publicComponent = () => (<p>{'TestPublicProduct'}</p>);

            const props = {
                ...baseProps,
                products: [{
                    id: 'productwithpublic',
                    baseURL: '/productwithpublic',
                    mainComponent,
                    publicComponent,
                } as unknown as ProductComponent,
                {
                    id: 'productwithoutpublic',
                    baseURL: '/productwithoutpublic',
                    mainComponent,
                    publicComponent: null,
                } as unknown as ProductComponent],
            };

            const wrapper = shallow(<Root {...props}/>);

            (wrapper.instance() as any).setState({configLoaded: true});
            expect(wrapper).toMatchSnapshot();
            wrapper.unmount();
        });
    });
});
