// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import deepEqual from 'fast-deep-equal';
import {Route, Switch, Redirect, RouteComponentProps} from 'react-router-dom';
import throttle from 'lodash/throttle';
import classNames from 'classnames';

import {Client4} from 'mattermost-redux/client';
import {rudderAnalytics, RudderTelemetryHandler} from 'mattermost-redux/client/rudder';
import {General} from 'mattermost-redux/constants';
import {Theme, getIsOnboardingFlowEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser, isCurrentUserSystemAdmin, checkIsFirstAdmin} from 'mattermost-redux/selectors/entities/users';
import {getActiveTeamsList} from 'mattermost-redux/selectors/entities/teams';
import {setUrl} from 'mattermost-redux/actions/general';
import {setSystemEmojis} from 'mattermost-redux/actions/emojis';

import {ProductComponent, PluginComponent} from 'types/store/plugins';

import {loadRecentlyUsedCustomEmojis} from 'actions/emoji_actions';
import * as GlobalActions from 'actions/global_actions';
import {measurePageLoadTelemetry, trackEvent, trackSelectorMetrics} from 'actions/telemetry_actions.jsx';

import SidebarRight from 'components/sidebar_right';
import AppBar from 'components/app_bar/app_bar';
import SidebarRightMenu from 'components/sidebar_right_menu';
import AnnouncementBarController from 'components/announcement_bar';
import SystemNotice from 'components/system_notice';

import {makeAsyncComponent} from 'components/async_load';
import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';
import GlobalHeader from 'components/global_header/global_header';
import CloudEffects from 'components/cloud_effects';
import ModalController from 'components/modal_controller';
import {HFTRoute, LoggedInHFTRoute} from 'components/header_footer_template_route';
import {HFRoute} from 'components/header_footer_route/header_footer_route';
import LaunchingWorkspace, {LAUNCHING_WORKSPACE_FULLSCREEN_Z_INDEX} from 'components/preparing_workspace/launching_workspace';
import {Animations} from 'components/preparing_workspace/steps';
import OpenPricingModalPost from 'components/custom_open_pricing_modal_post_renderer';
import OpenPluginInstallPost from 'components/custom_open_plugin_install_post_renderer';

import AccessProblem from 'components/access_problem';

import {initializePlugins} from 'plugins';
import Pluggable from 'plugins/pluggable';

import BrowserStore from 'stores/browser_store';

import Constants, {StoragePrefixes, WindowSizes} from 'utils/constants';
import {EmojiIndicesByAlias} from 'utils/emoji';
import * as UserAgent from 'utils/user_agent';
import * as Utils from 'utils/utils';

import webSocketClient from 'client/web_websocket_client.jsx';

import 'plugins/export.js';

const LazyErrorPage = React.lazy(() => import('components/error_page'));
const LazyLogin = React.lazy(() => import('components/login/login'));
const LazyAdminConsole = React.lazy(() => import('components/admin_console'));
const LazyLoggedIn = React.lazy(() => import('components/logged_in'));
const LazyPasswordResetSendLink = React.lazy(() => import('components/password_reset_send_link'));
const LazyPasswordResetForm = React.lazy(() => import('components/password_reset_form'));
const LazySignup = React.lazy(() => import('components/signup/signup'));
const LazyTermsOfService = React.lazy(() => import('components/terms_of_service'));
const LazyShouldVerifyEmail = React.lazy(() => import('components/should_verify_email/should_verify_email'));
const LazyDoVerifyEmail = React.lazy(() => import('components/do_verify_email/do_verify_email'));
const LazyClaimController = React.lazy(() => import('components/claim'));
const LazyLinkingLandingPage = React.lazy(() => import('components/linking_landing_page'));
const LazySelectTeam = React.lazy(() => import('components/select_team'));
const LazyAuthorize = React.lazy(() => import('components/authorize'));
const LazyCreateTeam = React.lazy(() => import('components/create_team'));
const LazyMfa = React.lazy(() => import('components/mfa/mfa_controller'));
const LazyPreparingWorkspace = React.lazy(() => import('components/preparing_workspace'));
const LazyTeamController = React.lazy(() => import('components/team_controller'));
const LazyDelinquencyModalController = React.lazy(() => import('components/delinquency_modal'));
const LazyOnBoardingTaskList = React.lazy(() => import('components/onboarding_tasklist'));

import store from 'stores/redux_store.jsx';
import {getSiteURL} from 'utils/url';
import A11yController from 'utils/a11y_controller';
import TeamSidebar from 'components/team_sidebar';

import {UserProfile} from '@mattermost/types/users';

import {ActionResult} from 'mattermost-redux/types/actions';

import {applyLuxonDefaults} from './effects';

import RootProvider from './root_provider';
import RootRedirect from './root_redirect';
import {ServiceEnvironment} from '@mattermost/types/config';

const CreateTeam = makeAsyncComponent('CreateTeam', LazyCreateTeam);
const ErrorPage = makeAsyncComponent('ErrorPage', LazyErrorPage);
const TermsOfService = makeAsyncComponent('TermsOfService', LazyTermsOfService);
const Login = makeAsyncComponent('LoginController', LazyLogin);
const AdminConsole = makeAsyncComponent('AdminConsole', LazyAdminConsole);
const LoggedIn = makeAsyncComponent('LoggedIn', LazyLoggedIn);
const PasswordResetSendLink = makeAsyncComponent('PasswordResedSendLink', LazyPasswordResetSendLink);
const PasswordResetForm = makeAsyncComponent('PasswordResetForm', LazyPasswordResetForm);
const Signup = makeAsyncComponent('SignupController', LazySignup);
const ShouldVerifyEmail = makeAsyncComponent('ShouldVerifyEmail', LazyShouldVerifyEmail);
const DoVerifyEmail = makeAsyncComponent('DoVerifyEmail', LazyDoVerifyEmail);
const ClaimController = makeAsyncComponent('ClaimController', LazyClaimController);
const LinkingLandingPage = makeAsyncComponent('LinkingLandingPage', LazyLinkingLandingPage);
const SelectTeam = makeAsyncComponent('SelectTeam', LazySelectTeam);
const Authorize = makeAsyncComponent('Authorize', LazyAuthorize);
const Mfa = makeAsyncComponent('Mfa', LazyMfa);
const PreparingWorkspace = makeAsyncComponent('PreparingWorkspace', LazyPreparingWorkspace);
const TeamController = makeAsyncComponent('TeamController', LazyTeamController);
const DelinquencyModalController = makeAsyncComponent('DelinquencyModalController', LazyDelinquencyModalController);
const OnBoardingTaskList = makeAsyncComponent('OnboardingTaskList', LazyOnBoardingTaskList);

type LoggedInRouteProps<T> = {
    component: React.ComponentType<T>;
    path: string;
    theme?: Theme; // the routes that send the theme are the ones that will actually need to show the onboarding tasklist
};
function LoggedInRoute<T>(props: LoggedInRouteProps<T>) {
    const {component: Component, theme, ...rest} = props;
    return (
        <Route
            {...rest}
            render={(routeProps: RouteComponentProps) => (
                <LoggedIn {...routeProps}>
                    {theme && <CompassThemeProvider theme={theme}>
                        <OnBoardingTaskList/>
                    </CompassThemeProvider>}
                    <Component {...(routeProps as unknown as T)}/>
                </LoggedIn>
            )}
        />
    );
}

const noop = () => {};

export type Actions = {
    emitBrowserWindowResized: (size?: string) => void;
    getFirstAdminSetupComplete: () => Promise<ActionResult>;
    getProfiles: (page?: number, pageSize?: number, options?: Record<string, any>) => Promise<ActionResult>;
    migrateRecentEmojis: () => void;
    loadConfigAndMe: () => Promise<{data: boolean}>;
    registerCustomPostRenderer: (type: string, component: any, id: string) => Promise<ActionResult>;
    initializeProducts: () => Promise<void[]>;
}

type Props = {
    theme: Theme;
    telemetryEnabled: boolean;
    telemetryId?: string;
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
    private desktopMediaQuery: MediaQueryList;
    private smallDesktopMediaQuery: MediaQueryList;
    private tabletMediaQuery: MediaQueryList;
    private mobileMediaQuery: MediaQueryList;
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
            if (!Utils.isTextDroppableEvent(e) && !document.body.classList.contains('focalboard-body')) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        this.state = {
            configLoaded: false,
        };

        this.a11yController = new A11yController();

        // set initial window size state
        this.desktopMediaQuery = window.matchMedia(`(min-width: ${Constants.DESKTOP_SCREEN_WIDTH + 1}px)`);
        this.smallDesktopMediaQuery = window.matchMedia(`(min-width: ${Constants.TABLET_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.DESKTOP_SCREEN_WIDTH}px)`);
        this.tabletMediaQuery = window.matchMedia(`(min-width: ${Constants.MOBILE_SCREEN_WIDTH + 1}px) and (max-width: ${Constants.TABLET_SCREEN_WIDTH}px)`);
        this.mobileMediaQuery = window.matchMedia(`(max-width: ${Constants.MOBILE_SCREEN_WIDTH}px)`);

        this.updateWindowSize();

        store.subscribe(() => applyLuxonDefaults(store.getState()));
    }

    onConfigLoaded = () => {
        const config = getConfig(store.getState());
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
            const siteURL = getConfig(store.getState()).SiteURL;
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
        loadRecentlyUsedCustomEmojis()(store.dispatch, store.getState);

        const iosDownloadLink = getConfig(store.getState()).IosAppDownloadLink;
        const androidDownloadLink = getConfig(store.getState()).AndroidAppDownloadLink;
        const desktopAppDownloadLink = getConfig(store.getState()).AppDownloadLink;

        const toResetPasswordScreen = this.props.location.pathname === '/reset_password_complete';

        // redirect to the mobile landing page if the user hasn't seen it before
        let landing;
        if (UserAgent.isAndroidWeb()) {
            landing = androidDownloadLink;
        } else if (UserAgent.isIosWeb()) {
            landing = iosDownloadLink;
        } else {
            landing = desktopAppDownloadLink;
        }

        if (landing && !this.props.isCloud && !BrowserStore.hasSeenLandingPage() && !toResetPasswordScreen && !this.props.location.pathname.includes('/landing') && !window.location.hostname?.endsWith('.test.mattermost.com') && !UserAgent.isDesktopApp() && !UserAgent.isChromebook()) {
            this.props.history.push('/landing#' + this.props.location.pathname + this.props.location.search);
            BrowserStore.setLandingPageSeen(true);
        }

        Utils.applyTheme(this.props.theme);
    };

    componentDidUpdate(prevProps: Props) {
        if (!deepEqual(prevProps.theme, this.props.theme)) {
            Utils.applyTheme(this.props.theme);
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

    async redirectToOnboardingOrDefaultTeam() {
        const storeState = store.getState();
        const isUserAdmin = isCurrentUserSystemAdmin(storeState);
        if (!isUserAdmin) {
            GlobalActions.redirectUserToDefaultTeam();
            return;
        }

        const teams = getActiveTeamsList(storeState);

        const onboardingFlowEnabled = getIsOnboardingFlowEnabled(storeState);

        if (teams.length > 0 || !onboardingFlowEnabled) {
            GlobalActions.redirectUserToDefaultTeam();
            return;
        }

        const firstAdminSetupComplete = await this.props.actions.getFirstAdminSetupComplete();
        if (firstAdminSetupComplete?.data) {
            GlobalActions.redirectUserToDefaultTeam();
            return;
        }

        const profilesResult = await this.props.actions.getProfiles(0, General.PROFILE_CHUNK_SIZE, {roles: General.SYSTEM_ADMIN_ROLE});
        if (profilesResult.error) {
            GlobalActions.redirectUserToDefaultTeam();
            return;
        }
        const currentUser = getCurrentUser(store.getState());
        const adminProfiles = profilesResult.data.reduce(
            (acc: Record<string, UserProfile>, curr: UserProfile) => {
                acc[curr.id] = curr;
                return acc;
            },
            {},
        );
        if (checkIsFirstAdmin(currentUser, adminProfiles)) {
            this.props.history.push('/preparing-workspace');
            return;
        }

        GlobalActions.redirectUserToDefaultTeam();
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
        const {data: isMeLoaded} = await this.props.actions.loadConfigAndMe();

        if (isMeLoaded && this.props.location.pathname === '/') {
            this.redirectToOnboardingOrDefaultTeam();
        }

        this.onConfigLoaded();
    };

    componentDidMount() {
        this.mounted = true;

        this.initiateMeRequests();

        // See figma design on issue https://mattermost.atlassian.net/browse/MM-43649
        this.props.actions.registerCustomPostRenderer('custom_up_notification', OpenPricingModalPost, 'upgrade_post_message_renderer');
        this.props.actions.registerCustomPostRenderer('custom_pl_notification', OpenPluginInstallPost, 'plugin_install_post_message_renderer');

        if (this.desktopMediaQuery.addEventListener) {
            this.desktopMediaQuery.addEventListener('change', this.handleMediaQueryChangeEvent);
            this.smallDesktopMediaQuery.addEventListener('change', this.handleMediaQueryChangeEvent);
            this.tabletMediaQuery.addEventListener('change', this.handleMediaQueryChangeEvent);
            this.mobileMediaQuery.addEventListener('change', this.handleMediaQueryChangeEvent);
        } else if (this.desktopMediaQuery.addListener) {
            this.desktopMediaQuery.addListener(this.handleMediaQueryChangeEvent);
            this.smallDesktopMediaQuery.addListener(this.handleMediaQueryChangeEvent);
            this.tabletMediaQuery.addListener(this.handleMediaQueryChangeEvent);
            this.mobileMediaQuery.addListener(this.handleMediaQueryChangeEvent);
        } else {
            window.addEventListener('resize', this.handleWindowResizeEvent);
        }

        measurePageLoadTelemetry();
        trackSelectorMetrics();
    }

    componentWillUnmount() {
        this.mounted = false;
        window.removeEventListener('storage', this.handleLogoutLoginSignal);

        if (this.desktopMediaQuery.removeEventListener) {
            this.desktopMediaQuery.removeEventListener('change', this.handleMediaQueryChangeEvent);
            this.smallDesktopMediaQuery.removeEventListener('change', this.handleMediaQueryChangeEvent);
            this.tabletMediaQuery.removeEventListener('change', this.handleMediaQueryChangeEvent);
            this.mobileMediaQuery.removeEventListener('change', this.handleMediaQueryChangeEvent);
        } else if (this.desktopMediaQuery.removeListener) {
            this.desktopMediaQuery.removeListener(this.handleMediaQueryChangeEvent);
            this.smallDesktopMediaQuery.removeListener(this.handleMediaQueryChangeEvent);
            this.tabletMediaQuery.removeListener(this.handleMediaQueryChangeEvent);
            this.mobileMediaQuery.removeListener(this.handleMediaQueryChangeEvent);
        } else {
            window.removeEventListener('resize', this.handleWindowResizeEvent);
        }
    }

    handleLogoutLoginSignal = (e: StorageEvent) => {
        // when one tab on a browser logs out, it sets __logout__ in localStorage to trigger other tabs to log out
        const isNewLocalStorageEvent = (event: StorageEvent) => event.storageArea === localStorage && event.newValue;

        if (e.key === StoragePrefixes.LOGOUT && isNewLocalStorageEvent(e)) {
            console.log('detected logout from a different tab'); //eslint-disable-line no-console
            GlobalActions.emitUserLoggedOutEvent('/', false, false);
        }
        if (e.key === StoragePrefixes.LOGIN && isNewLocalStorageEvent(e)) {
            const isLoggedIn = getCurrentUser(store.getState());

            // make sure this is not the same tab which sent login signal
            // because another tabs will also send login signal after reloading
            if (isLoggedIn) {
                return;
            }

            // detected login from a different tab
            function reloadOnFocus() {
                location.reload();
            }
            window.addEventListener('focus', reloadOnFocus);
        }
    };

    handleWindowResizeEvent = throttle(() => {
        this.props.actions.emitBrowserWindowResized();
    }, 100);

    handleMediaQueryChangeEvent = (e: MediaQueryListEvent) => {
        if (e.matches) {
            this.updateWindowSize();
        }
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

    updateWindowSize = () => {
        switch (true) {
        case this.desktopMediaQuery.matches:
            this.props.actions.emitBrowserWindowResized(WindowSizes.DESKTOP_VIEW);
            break;
        case this.smallDesktopMediaQuery.matches:
            this.props.actions.emitBrowserWindowResized(WindowSizes.SMALL_DESKTOP_VIEW);
            break;
        case this.tabletMediaQuery.matches:
            this.props.actions.emitBrowserWindowResized(WindowSizes.TABLET_VIEW);
            break;
        case this.mobileMediaQuery.matches:
            this.props.actions.emitBrowserWindowResized(WindowSizes.MOBILE_VIEW);
            break;
        }
    };

    render() {
        if (!this.state.configLoaded) {
            return <div/>;
        }

        return (
            <RootProvider>
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
                        <ModalController/>
                        <AnnouncementBarController/>
                        <SystemNotice/>
                        <GlobalHeader/>
                        <CloudEffects/>
                        <TeamSidebar/>
                        <DelinquencyModalController/>
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
                                path={'/:team'}
                                component={TeamController}
                            />
                            <RootRedirect/>
                        </Switch>
                        <Pluggable pluggableName='Global'/>
                        <SidebarRight/>
                        <AppBar/>
                        <SidebarRightMenu/>
                    </CompassThemeProvider>
                </Switch>
            </RootProvider>
        );
    }
}
