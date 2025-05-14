// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import deepEqual from 'fast-deep-equal';
import React, {lazy} from 'react';
import {Route, Switch, Redirect} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import {ServiceEnvironment} from '@mattermost/types/config';

import {setSystemEmojis} from 'mattermost-redux/actions/emojis';
import {setUrl} from 'mattermost-redux/actions/general';
import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';

import {measurePageLoadTelemetry, temporarilySetPageLoadContext, trackEvent} from 'actions/telemetry_actions.jsx';
import BrowserStore from 'stores/browser_store';

import {makeAsyncComponent, makeAsyncPluggableComponent} from 'components/async_load';
import GlobalHeader from 'components/global_header/global_header';
import {HFRoute} from 'components/header_footer_route/header_footer_route';
import {HFTRoute, LoggedInHFTRoute} from 'components/header_footer_template_route';
import InitialLoadingScreen from 'components/initial_loading_screen';
import LoggedIn from 'components/logged_in';
import LoggedInRoute from 'components/logged_in_route';
import {LAUNCHING_WORKSPACE_FULLSCREEN_Z_INDEX} from 'components/preparing_workspace/launching_workspace';
import {Animations} from 'components/preparing_workspace/steps';

import webSocketClient from 'client/web_websocket_client';
import {initializePlugins} from 'plugins';
import 'utils/a11y_controller_instance';
import {PageLoadContext, SCHEDULED_POST_URL_SUFFIX} from 'utils/constants';
import DesktopApp from 'utils/desktop_api';
import {EmojiIndicesByAlias} from 'utils/emoji';
import {TEAM_NAME_PATH_PATTERN} from 'utils/path';
import {rudderAnalytics, RudderTelemetryHandler} from 'utils/rudder';
import {getSiteURL} from 'utils/url';
import {isAndroidWeb, isChromebook, isDesktopApp, isIosWeb} from 'utils/user_agent';
import {applyTheme, isTextDroppableEvent} from 'utils/utils';

import LuxonController from './luxon_controller';
import PerformanceReporterController from './performance_reporter_controller';
import RootProvider from './root_provider';
import RootRedirect from './root_redirect';

import type {PropsFromRedux} from './index';

import 'plugins/export';

const MobileViewWatcher = makeAsyncComponent('MobileViewWatcher', lazy(() => import('components/mobile_view_watcher')));
const WindowSizeObserver = makeAsyncComponent('WindowSizeObserver', lazy(() => import('components/window_size_observer/WindowSizeObserver')));
const ErrorPage = makeAsyncComponent('ErrorPage', lazy(() => import('components/error_page')));
const Login = makeAsyncComponent('LoginController', lazy(() => import('components/login/login')));
const AccessProblem = makeAsyncComponent('AccessProblem', lazy(() => import('components/access_problem')));
const PasswordResetSendLink = makeAsyncComponent('PasswordResedSendLink', lazy(() => import('components/password_reset_send_link')));
const PasswordResetForm = makeAsyncComponent('PasswordResetForm', lazy(() => import('components/password_reset_form')));
const Signup = makeAsyncComponent('SignupController', lazy(() => import('components/signup/signup')));
const ShouldVerifyEmail = makeAsyncComponent('ShouldVerifyEmail', lazy(() => import('components/should_verify_email/should_verify_email')));
const DoVerifyEmail = makeAsyncComponent('DoVerifyEmail', lazy(() => import('components/do_verify_email/do_verify_email')));
const ClaimController = makeAsyncComponent('ClaimController', lazy(() => import('components/claim')));
const TermsOfService = makeAsyncComponent('TermsOfService', lazy(() => import('components/terms_of_service')));
const LinkingLandingPage = makeAsyncComponent('LinkingLandingPage', lazy(() => import('components/linking_landing_page')));
const AdminConsole = makeAsyncComponent('AdminConsole', lazy(() => import('components/admin_console')));
const SelectTeam = makeAsyncComponent('SelectTeam', lazy(() => import('components/select_team')));
const Authorize = makeAsyncComponent('Authorize', lazy(() => import('components/authorize')));
const CreateTeam = makeAsyncComponent('CreateTeam', lazy(() => import('components/create_team')));
const Mfa = makeAsyncComponent('Mfa', lazy(() => import('components/mfa/mfa_controller')));
const PreparingWorkspace = makeAsyncComponent('PreparingWorkspace', lazy(() => import('components/preparing_workspace')));
const LaunchingWorkspace = makeAsyncComponent('LaunchingWorkspace', lazy(() => import('components/preparing_workspace/launching_workspace')));
const CompassThemeProvider = makeAsyncComponent('CompassThemeProvider', lazy(() => import('components/compass_theme_provider/compass_theme_provider')));
const TeamController = makeAsyncComponent('TeamController', lazy(() => import('components/team_controller')));
const AnnouncementBarController = makeAsyncComponent('AnnouncementBarController', lazy(() => import('components/announcement_bar')));
const SystemNotice = makeAsyncComponent('SystemNotice', lazy(() => import('components/system_notice')));
const CloudEffects = makeAsyncComponent('CloudEffects', lazy(() => import('components/cloud_effects')));
const TeamSidebar = makeAsyncComponent('TeamSidebar', lazy(() => import('components/team_sidebar')));
const SidebarRight = makeAsyncComponent('SidebarRight', lazy(() => import('components/sidebar_right')));
const ModalController = makeAsyncComponent('ModalController', lazy(() => import('components/modal_controller')));
const AppBar = makeAsyncComponent('AppBar', lazy(() => import('components/app_bar/app_bar')));
const ComponentLibrary = makeAsyncComponent('ComponentLibrary', lazy(() => import('components/component_library')));

const Pluggable = makeAsyncPluggableComponent();

const noop = () => {};

export type Props = PropsFromRedux & RouteComponentProps & {
    customProfileAttributesEnabled?: boolean;
}

interface State {
    shouldMountAppRoutes?: boolean;
}

export default class Root extends React.PureComponent<Props, State> {
    // The constructor adds a bunch of event listeners,
    // so we do need this.
    constructor(props: Props) {
        super(props);

        setUrl(getSiteURL());

        // Disable auth header to enable CSRF check
        Client4.setAuthHeader = false;

        setSystemEmojis(new Set(EmojiIndicesByAlias.keys()));

        this.state = {
            shouldMountAppRoutes: false,
        };
    }

    setRudderConfig = () => {
        const telemetryId = this.props.telemetryId;

        const rudderUrl = 'https://pdat.matterlytics.com';
        let rudderKey = '';
        switch (this.props.serviceEnvironment) {
        case ServiceEnvironment.PRODUCTION:
            rudderKey = '1aoejPqhgONMI720CsBSRWzzRQ9';
            break;
        case ServiceEnvironment.TEST:
            rudderKey = '1aoeoCDeh7OCHcbW2kseWlwUFyq';
            break;
        case ServiceEnvironment.DEV:
            break;
        }

        if (rudderKey !== '' && this.props.telemetryEnabled) {
            const rudderCfg: {setCookieDomain?: string} = {};
            if (this.props.siteURL !== '') {
                try {
                    rudderCfg.setCookieDomain = new URL(this.props.siteURL || '').hostname;
                } catch (_) {
                    // eslint-disable-next-line no-console
                    console.error('Failed to set cookie domain for RudderStack');
                }
            }

            rudderAnalytics.load(rudderKey, rudderUrl || '', rudderCfg);

            rudderAnalytics.identify(telemetryId, {}, {
                context: {
                    ip: '0.0.0.0',
                },
                page: {
                    path: '',
                    referrer: '',
                    search: '',
                    title: '',
                    url: '',
                },
                anonymousId: '00000000000000000000000000',
            });

            rudderAnalytics.page('ApplicationLoaded', {
                path: '',
                referrer: '',
                search: ('' as any),
                title: '',
                url: '',
            } as any,
            {
                context: {
                    ip: '0.0.0.0',
                },
                anonymousId: '00000000000000000000000000',
            });

            const utmParams = this.captureUTMParams();
            rudderAnalytics.ready(() => {
                Client4.setTelemetryHandler(new RudderTelemetryHandler());
                if (utmParams) {
                    trackEvent('utm_params', 'utm_params', utmParams);
                }
            });
        }
    };

    onConfigLoaded = () => {
        Promise.all([
            this.props.actions.initializeProducts(),
            initializePlugins(),
        ]).then(() => {
            this.setState({shouldMountAppRoutes: true});
        });

        this.props.actions.migrateRecentEmojis();
        this.props.actions.loadRecentlyUsedCustomEmojis();
        this.showLandingPageIfNecessary();

        this.applyTheme();
    };

    private showLandingPageIfNecessary = () => {
        // Only show Landing Page if enabled
        if (!this.props.enableDesktopLandingPage) {
            return;
        }

        // We have nothing to redirect to if we're already on Desktop App
        // Chromebook has no Desktop App to switch to
        if (isDesktopApp() || isChromebook()) {
            return;
        }

        // Nothing to link to if we've removed the Android App download link
        if (isAndroidWeb() && !this.props.androidDownloadLink) {
            return;
        }

        // Nothing to link to if we've removed the iOS App download link
        if (isIosWeb() && !this.props.iosDownloadLink) {
            return;
        }

        // Nothing to link to if we've removed the Desktop App download link
        if (!this.props.appDownloadLink) {
            return;
        }

        // Only show the landing page once
        if (BrowserStore.hasSeenLandingPage()) {
            return;
        }

        // We don't want to show when resetting the password
        if (this.props.location.pathname === '/reset_password_complete') {
            return;
        }

        // We don't want to show when we're doing Desktop App external login
        if (this.props.location.pathname === '/login/desktop') {
            return;
        }

        // Stop this infinitely redirecting
        if (this.props.location.pathname.includes('/landing')) {
            return;
        }

        // Disabled to avoid breaking the CWS flow
        if (this.props.isCloud) {
            return;
        }

        // Disable for Rainforest tests
        if (window.location.hostname?.endsWith('.test.mattermost.com')) {
            return;
        }

        this.props.history.push('/landing#' + this.props.location.pathname + this.props.location.search);
        BrowserStore.setLandingPageSeen(true);
    };

    applyTheme() {
        // don't apply theme when in system console; system console hardcoded to THEMES.denim
        // AdminConsole will apply denim on mount re-apply user theme on unmount
        if (this.props.location.pathname.startsWith('/admin_console')) {
            return;
        }

        applyTheme(this.props.theme);
    }

    componentDidUpdate(prevProps: Props, prevState: State) {
        if (!deepEqual(prevProps.theme, this.props.theme)) {
            this.applyTheme();
        }

        if (this.props.location.pathname === '/') {
            if (this.props.noAccounts) {
                prevProps.history.push('/signup_user_complete');
            } else if (this.props.showTermsOfService) {
                prevProps.history.push('/terms_of_service');
            }
        }

        if (
            this.props.shouldShowAppBar !== prevProps.shouldShowAppBar ||
            this.props.rhsIsOpen !== prevProps.rhsIsOpen ||
            this.props.rhsIsExpanded !== prevProps.rhsIsExpanded
        ) {
            this.setRootMeta();
        }

        if (!prevProps.isConfigLoaded && this.props.isConfigLoaded) {
            this.setRudderConfig();
            if (this.props.customProfileAttributesEnabled) {
                this.props.actions.getCustomProfileAttributeFields();
            }
        }

        if (prevState.shouldMountAppRoutes === false && this.state.shouldMountAppRoutes === true) {
            if (!doesRouteBelongToTeamControllerRoutes(this.props.location.pathname)) {
                DesktopApp.reactAppInitialized();
                InitialLoadingScreen.stop('root');
            }
        }
    }

    captureUTMParams() {
        const qs = new URLSearchParams(window.location.search);

        // list of key that we want to track
        const keys = ['utm_source', 'utm_medium', 'utm_campaign'];

        const campaign = keys.reduce((acc, key) => {
            if (qs.has(key)) {
                const value = qs.get(key);
                if (value) {
                    acc[key] = value;
                }
                qs.delete(key);
            }
            return acc;
        }, {} as Record<string, string>);

        if (Object.keys(campaign).length > 0) {
            this.props.history.replace({search: qs.toString()});
            return campaign;
        }
        return null;
    }

    initiateMeRequests = async () => {
        const {isLoaded, isMeRequested} = await this.props.actions.loadConfigAndMe();

        if (isLoaded) {
            const isUserAtRootRoute = this.props.location.pathname === '/';

            if (isUserAtRootRoute) {
                if (isMeRequested) {
                    this.props.actions.redirectToOnboardingOrDefaultTeam(this.props.history, new URLSearchParams(this.props.location.search));
                } else if (this.props.noAccounts) {
                    this.props.history.push('/signup_user_complete');
                }
            }

            this.onConfigLoaded();
        }
    };

    handleDropEvent = (e: DragEvent) => {
        if (e.dataTransfer && e.dataTransfer.items.length > 0 && e.dataTransfer.items[0].kind === 'file') {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    handleDragOverEvent = (e: DragEvent) => {
        if (!isTextDroppableEvent(e) && !document.body.classList.contains('focalboard-body')) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    componentDidMount() {
        temporarilySetPageLoadContext(PageLoadContext.PAGE_LOAD);

        this.initiateMeRequests();

        measurePageLoadTelemetry();

        // Force logout of all tabs if one tab is logged out
        window.addEventListener('storage', this.handleLogoutLoginSignal);

        // Prevent drag and drop files from navigating away from the app
        document.addEventListener('drop', this.handleDropEvent);

        document.addEventListener('dragover', this.handleDragOverEvent);
    }

    componentWillUnmount() {
        window.removeEventListener('storage', this.handleLogoutLoginSignal);
        document.removeEventListener('drop', this.handleDropEvent);
        document.removeEventListener('dragover', this.handleDragOverEvent);
    }

    handleLogoutLoginSignal = (e: StorageEvent) => {
        this.props.actions.handleLoginLogoutSignal(e);
    };

    setRootMeta = () => {
        const root = document.getElementById('root')!;

        for (const [className, enabled] of Object.entries({
            'app-bar-enabled': this.props.shouldShowAppBar,
            'rhs-open': this.props.rhsIsOpen,
            'rhs-open-expanded': this.props.rhsIsExpanded,
        })) {
            root.classList.toggle(className, enabled);
        }
    };

    render() {
        if (!this.state.shouldMountAppRoutes) {
            return <div/>;
        }

        return (
            <RootProvider>
                <MobileViewWatcher/>
                <LuxonController/>
                <PerformanceReporterController/>
                <Switch>
                    <Route
                        path={'/error'}
                        component={ErrorPage}
                    />
                    <HFRoute
                        path={'/login'}
                        component={Login}
                    />
                    <HFRoute
                        path={'/access_problem'}
                        component={AccessProblem}
                    />
                    <HFTRoute
                        path={'/reset_password'}
                        component={PasswordResetSendLink}
                    />
                    <HFTRoute
                        path={'/reset_password_complete'}
                        component={PasswordResetForm}
                    />
                    <HFRoute
                        path={'/signup_user_complete'}
                        component={Signup}
                    />
                    <HFRoute
                        path={'/should_verify_email'}
                        component={ShouldVerifyEmail}
                    />
                    <HFRoute
                        path={'/do_verify_email'}
                        component={DoVerifyEmail}
                    />
                    <HFTRoute
                        path={'/claim'}
                        component={ClaimController}
                    />
                    <LoggedInRoute
                        path={'/terms_of_service'}
                        component={TermsOfService}
                    />
                    <Route
                        path={'/landing'}
                        component={LinkingLandingPage}
                    />
                    {this.props.isDevModeEnabled && (
                        <Route
                            path={'/component_library'}
                            component={ComponentLibrary}
                        />
                    )}
                    <Route
                        path={'/admin_console'}
                    >
                        <Switch>
                            <LoggedInRoute
                                theme={Preferences.THEMES.denim}
                                path={'/admin_console'}
                                component={AdminConsole}
                            />
                            <RootRedirect/>
                        </Switch>
                    </Route>
                    <LoggedInHFTRoute
                        path={'/select_team'}
                        component={SelectTeam}
                    />
                    <LoggedInHFTRoute
                        path={'/oauth/authorize'}
                        component={Authorize}
                    />
                    <LoggedInHFTRoute
                        path={'/create_team'}
                        component={CreateTeam}
                    />
                    <LoggedInRoute
                        path={'/mfa'}
                        component={Mfa}
                    />
                    <LoggedInRoute
                        path={'/preparing-workspace'}
                        component={PreparingWorkspace}
                    />
                    <Redirect
                        from={'/_redirect/integrations/:subpath*'}
                        to={`/${this.props.permalinkRedirectTeamName}/integrations/:subpath*`}
                    />
                    <Redirect
                        from={'/_redirect/pl/:postid'}
                        to={`/${this.props.permalinkRedirectTeamName}/pl/:postid`}
                    />
                    <CompassThemeProvider theme={this.props.theme}>
                        {(this.props.showLaunchingWorkspace && !this.props.location.pathname.includes('/preparing-workspace') &&
                            <LaunchingWorkspace
                                fullscreen={true}
                                zIndex={LAUNCHING_WORKSPACE_FULLSCREEN_Z_INDEX}
                                show={true}
                                onPageView={noop}
                                transitionDirection={Animations.Reasons.EnterFromBefore}
                            />
                        )}
                        <WindowSizeObserver/>
                        <ModalController/>
                        <AnnouncementBarController/>
                        <SystemNotice/>
                        <GlobalHeader/>
                        <CloudEffects/>
                        <TeamSidebar/>
                        <div className='main-wrapper'>
                            <Switch>
                                {this.props.products?.filter((product) => Boolean(product.publicComponent)).map((product) => (
                                    <Route
                                        key={`${product.id}-public`}
                                        path={`${product.baseURL}/public`}
                                        render={(props) => {
                                            return (
                                                <Pluggable
                                                    pluggableName={'Product'}
                                                    subComponentName={'publicComponent'}
                                                    pluggableId={product.id}
                                                    css={{gridArea: 'center'}}
                                                    {...props}
                                                />
                                            );
                                        }}
                                    />
                                ))}
                                {this.props.products?.map((product) => (
                                    <Route
                                        key={product.id}
                                        path={product.baseURL}
                                        render={(props) => {
                                            let pluggable = (
                                                <Pluggable
                                                    pluggableName={'Product'}
                                                    subComponentName={'mainComponent'}
                                                    pluggableId={product.id}
                                                    webSocketClient={webSocketClient}
                                                    css={product.wrapped ? undefined : {gridArea: 'center'}}
                                                />
                                            );
                                            if (product.wrapped) {
                                                pluggable = (
                                                    <div className={classNames(['product-wrapper', {wide: !product.showTeamSidebar}])}>
                                                        {pluggable}
                                                    </div>
                                                );
                                            }
                                            return (
                                                <LoggedIn {...props}>
                                                    {pluggable}
                                                </LoggedIn>
                                            );
                                        }}
                                    />
                                ))}
                                {this.props.plugins?.map((plugin) => (
                                    <Route
                                        key={plugin.id}
                                        path={'/plug/' + plugin.route}
                                        render={() => (
                                            <Pluggable
                                                pluggableName={'CustomRouteComponent'}
                                                pluggableId={plugin.id}
                                                css={{gridArea: 'center'}}
                                            />
                                        )}
                                    />
                                ))}
                                <LoggedInRoute
                                    theme={this.props.theme}
                                    path={`/:team(${TEAM_NAME_PATH_PATTERN})`}
                                    component={TeamController}
                                />
                                <RootRedirect/>
                            </Switch>
                            <SidebarRight/>
                        </div>
                        <Pluggable pluggableName='Global'/>
                        <AppBar/>
                    </CompassThemeProvider>
                </Switch>
            </RootProvider>
        );
    }
}

export function doesRouteBelongToTeamControllerRoutes(pathname: RouteComponentProps['location']['pathname']): boolean {
    // Note: we have specifically added admin_console to the negative lookahead as admin_console can have integrations as subpaths (admin_console/integrations/bot_accounts)
    // and we don't want to treat those as team controller routes.
    const TEAM_CONTROLLER_PATH_PATTERN = new RegExp(`^/(?!admin_console)([a-z0-9\\-_]+)/(channels|messages|threads|drafts|integrations|emoji|${SCHEDULED_POST_URL_SUFFIX})(/.*)?$`);

    return TEAM_CONTROLLER_PATH_PATTERN.test(pathname);
}
