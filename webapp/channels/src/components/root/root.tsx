// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import deepEqual from 'fast-deep-equal';
import type {History} from 'history';
import React, {lazy} from 'react';
import {Route, Switch, Redirect} from 'react-router-dom';
import type {RouteComponentProps} from 'react-router-dom';

import type {ClientConfig} from '@mattermost/types/config';
import {ServiceEnvironment} from '@mattermost/types/config';

import {setSystemEmojis} from 'mattermost-redux/actions/emojis';
import {setUrl} from 'mattermost-redux/actions/general';
import {Client4} from 'mattermost-redux/client';
import {rudderAnalytics, RudderTelemetryHandler} from 'mattermost-redux/client/rudder';
import type {Theme} from 'mattermost-redux/selectors/entities/preferences';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {measurePageLoadTelemetry, temporarilySetPageLoadContext, trackEvent, trackSelectorMetrics} from 'actions/telemetry_actions.jsx';
import BrowserStore from 'stores/browser_store';

import {makeAsyncComponent} from 'components/async_load';
import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';
import OpenPluginInstallPost from 'components/custom_open_plugin_install_post_renderer';
import {HFRoute} from 'components/header_footer_route/header_footer_route';
import {HFTRoute, LoggedInHFTRoute} from 'components/header_footer_template_route';
import MobileViewWatcher from 'components/mobile_view_watcher';
import LaunchingWorkspace, {LAUNCHING_WORKSPACE_FULLSCREEN_Z_INDEX} from 'components/preparing_workspace/launching_workspace';
import {Animations} from 'components/preparing_workspace/steps';
import WindowSizeObserver from 'components/window_size_observer/WindowSizeObserver';

import webSocketClient from 'client/web_websocket_client';
import {initializePlugins} from 'plugins';
import A11yController from 'utils/a11y_controller';
import {PageLoadContext} from 'utils/constants';
import {EmojiIndicesByAlias} from 'utils/emoji';
import {TEAM_NAME_PATH_PATTERN} from 'utils/path';
import {getSiteURL} from 'utils/url';
import {isAndroidWeb, isChromebook, isDesktopApp, isIosWeb} from 'utils/user_agent';
import {applyTheme, isTextDroppableEvent} from 'utils/utils';

import type {ProductComponent, PluginComponent} from 'types/store/plugins';

import LuxonController from './luxon_controller';
import PerformanceReporterController from './performance_reporter_controller';
import RootProvider from './root_provider';
import RootRedirect from './root_redirect';

import 'plugins/export.js';

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
const Pluggable = makeAsyncComponent('Pluggable', lazy(() => import('plugins/pluggable')));
const LoggedIn = makeAsyncComponent('LoggedIn', lazy(() => import('components/logged_in')));
const TeamController = makeAsyncComponent('TeamController', lazy(() => import('components/team_controller')));
const OnBoardingTaskList = makeAsyncComponent('OnboardingTaskList', lazy(() => import('components/onboarding_tasklist')));
const AnnouncementBarController = makeAsyncComponent('AnnouncementBarController', lazy(() => import('components/announcement_bar')));
const SystemNotice = makeAsyncComponent('SystemNotice', lazy(() => import('components/system_notice')));
const GlobalHeader = makeAsyncComponent('GlobalHeader', lazy(() => import('components/global_header/global_header')));
const CloudEffects = makeAsyncComponent('CloudEffects', lazy(() => import('components/cloud_effects')));
const TeamSidebar = makeAsyncComponent('TeamSidebar', lazy(() => import('components/team_sidebar')));
const SidebarRight = makeAsyncComponent('SidebarRight', lazy(() => import('components/sidebar_right')));
const ModalController = makeAsyncComponent('ModalController', lazy(() => import('components/modal_controller')));
const AppBar = makeAsyncComponent('AppBar', lazy(() => import('components/app_bar/app_bar')));

type LoggedInRouteProps = {
    component: React.ComponentType<RouteComponentProps<any>>;
    path: string | string[];
    theme?: Theme; // the routes that send the theme are the ones that will actually need to show the onboarding tasklist
};

function LoggedInRoute(props: LoggedInRouteProps) {
    const {component: Component, theme, ...rest} = props;
    return (
        <Route
            {...rest}
            render={(routeProps) => (
                <LoggedIn {...routeProps}>
                    {theme && <CompassThemeProvider theme={theme}>
                        <OnBoardingTaskList/>
                    </CompassThemeProvider>}
                    <Component {...(routeProps)}/>
                </LoggedIn>
            )}
        />
    );
}

const noop = () => {};

export type Actions = {
    getProfiles: (page?: number, pageSize?: number, options?: Record<string, any>) => Promise<ActionResult>;
    loadRecentlyUsedCustomEmojis: () => Promise<unknown>;
    migrateRecentEmojis: () => void;
    loadConfigAndMe: () => Promise<{config?: Partial<ClientConfig>; isMeLoaded: boolean}>;
    registerCustomPostRenderer: (type: string, component: any, id: string) => Promise<ActionResult>;
    initializeProducts: () => Promise<unknown>;
    handleLoginLogoutSignal: (e: StorageEvent) => unknown;
    redirectToOnboardingOrDefaultTeam: (history: History) => unknown;
}

type Props = {
    theme: Theme;
    telemetryEnabled: boolean;
    telemetryId?: string;
    iosDownloadLink?: string;
    androidDownloadLink?: string;
    appDownloadLink?: string;
    noAccounts: boolean;
    showTermsOfService: boolean;
    permalinkRedirectTeamName: string;
    isCloud: boolean;
    actions: Actions;
    plugins?: PluginComponent[];
    products: ProductComponent[];
    showLaunchingWorkspace: boolean;
    rhsIsExpanded: boolean;
    rhsIsOpen: boolean;
    shouldShowAppBar: boolean;
} & RouteComponentProps

interface State {
    configLoaded?: boolean;
}

export default class Root extends React.PureComponent<Props, State> {
    private mounted: boolean;

    // The constructor adds a bunch of event listeners,
    // so we do need this.
    private a11yController: A11yController;

    constructor(props: Props) {
        super(props);
        this.mounted = false;

        // Redux
        setUrl(getSiteURL());

        // Disable auth header to enable CSRF check
        Client4.setAuthHeader = false;

        setSystemEmojis(new Set(EmojiIndicesByAlias.keys()));

        // Force logout of all tabs if one tab is logged out
        window.addEventListener('storage', this.handleLogoutLoginSignal);

        // Prevent drag and drop files from navigating away from the app
        document.addEventListener('drop', (e) => {
            if (e.dataTransfer && e.dataTransfer.items.length > 0 && e.dataTransfer.items[0].kind === 'file') {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        document.addEventListener('dragover', (e) => {
            if (!isTextDroppableEvent(e) && !document.body.classList.contains('focalboard-body')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        this.state = {
            configLoaded: false,
        };

        this.a11yController = new A11yController();
    }

    onConfigLoaded = (config: Partial<ClientConfig>) => {
        const telemetryId = this.props.telemetryId;

        const rudderUrl = 'https://pdat.matterlytics.com';
        let rudderKey = '';
        switch (config.ServiceEnvironment) {
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
            const siteURL = config.SiteURL;
            if (siteURL !== '') {
                try {
                    rudderCfg.setCookieDomain = new URL(siteURL || '').hostname;
                    // eslint-disable-next-line no-empty
                } catch (_) {}
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

        if (this.props.location.pathname === '/' && this.props.noAccounts) {
            this.props.history.push('/signup_user_complete');
        }

        Promise.all([
            this.props.actions.initializeProducts(),
            initializePlugins(),
        ]).then(() => {
            if (this.mounted) {
                // supports enzyme tests, set state if and only if
                // the component is still mounted on screen
                this.setState({configLoaded: true});
            }
        });

        this.props.actions.migrateRecentEmojis();
        this.props.actions.loadRecentlyUsedCustomEmojis();

        this.showLandingPageIfNecessary();

        applyTheme(this.props.theme);
    };

    private showLandingPageIfNecessary = () => {
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

    componentDidUpdate(prevProps: Props) {
        if (!deepEqual(prevProps.theme, this.props.theme)) {
            applyTheme(this.props.theme);
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
        const {config, isMeLoaded} = await this.props.actions.loadConfigAndMe();

        if (isMeLoaded && this.props.location.pathname === '/') {
            this.props.actions.redirectToOnboardingOrDefaultTeam(this.props.history);
        }

        if (config) {
            this.onConfigLoaded(config);
        }
    };

    componentDidMount() {
        temporarilySetPageLoadContext(PageLoadContext.PAGE_LOAD);

        this.mounted = true;

        this.initiateMeRequests();

        // See figma design on issue https://mattermost.atlassian.net/browse/MM-43649
        this.props.actions.registerCustomPostRenderer('custom_pl_notification', OpenPluginInstallPost, 'plugin_install_post_message_renderer');

        measurePageLoadTelemetry();
        trackSelectorMetrics();
    }

    componentWillUnmount() {
        this.mounted = false;
        window.removeEventListener('storage', this.handleLogoutLoginSignal);
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
        if (!this.state.configLoaded) {
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
                    <Route
                        path={'/admin_console'}
                    >
                        <Switch>
                            <LoggedInRoute
                                theme={this.props.theme}
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
                                        path={'/plug/' + (plugin as any).route}
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
