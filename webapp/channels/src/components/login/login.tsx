// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import throttle from 'lodash/throttle';
import React, {useState, useEffect, useRef, useCallback} from 'react';
import type {FormEvent} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {Link, useLocation, useHistory, Route} from 'react-router-dom';

import type {Team} from '@mattermost/types/teams';

import {loadMe} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {RequestStatus} from 'mattermost-redux/constants';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getIsOnboardingFlowEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getTeamByName, getMyTeamMember} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {addUserToTeamFromInvite} from 'actions/team_actions';
import {trackEvent} from 'actions/telemetry_actions';
import {login} from 'actions/views/login';
import LocalStorageStore from 'stores/local_storage_store';

import AlertBanner from 'components/alert_banner';
import type {ModeType, AlertBannerProps} from 'components/alert_banner';
import type {SubmitOptions} from 'components/claim/components/email_to_ldap';
import DesktopAuthToken from 'components/desktop_auth_token';
import ExternalLink from 'components/external_link';
import ExternalLoginButton from 'components/external_login_button/external_login_button';
import type {ExternalLoginButtonType} from 'components/external_login_button/external_login_button';
import AlternateLinkLayout from 'components/header_footer_route/content_layouts/alternate_link';
import ColumnLayout from 'components/header_footer_route/content_layouts/column';
import type {CustomizeHeaderType} from 'components/header_footer_route/header_footer_route';
import LoadingScreen from 'components/loading_screen';
import Markdown from 'components/markdown';
import SaveButton from 'components/save_button';
import EntraIdIcon from 'components/widgets/icons/entra_id_icon';
import LockIcon from 'components/widgets/icons/lock_icon';
import LoginGitlabIcon from 'components/widgets/icons/login_gitlab_icon';
import LoginGoogleIcon from 'components/widgets/icons/login_google_icon';
import LoginOpenIDIcon from 'components/widgets/icons/login_openid_icon';
import Input, {SIZE} from 'components/widgets/inputs/input/input';
import PasswordInput from 'components/widgets/inputs/password_input/password_input';

import Constants from 'utils/constants';
import DesktopApp from 'utils/desktop_api';
import {t} from 'utils/i18n';
import {showNotification} from 'utils/notifications';
import {isDesktopApp} from 'utils/user_agent';
import {setCSRFFromCookie} from 'utils/utils';

import type {GlobalState} from 'types/store';

import LoginMfa from './login_mfa';

import './login.scss';

const MOBILE_SCREEN_WIDTH = 1200;

type LoginProps = {
    onCustomizeHeader?: CustomizeHeaderType;
}

const Login = ({onCustomizeHeader}: LoginProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const history = useHistory();
    const {pathname, search, hash} = useLocation();

    const searchParam = new URLSearchParams(search);
    const extraParam = searchParam.get('extra');
    const emailParam = searchParam.get('email');

    const {
        EnableLdap,
        EnableSaml,
        EnableSignInWithEmail,
        EnableSignInWithUsername,
        EnableSignUpWithEmail,
        EnableSignUpWithGitLab,
        EnableSignUpWithOffice365,
        EnableSignUpWithGoogle,
        EnableSignUpWithOpenId,
        EnableOpenServer,
        EnableUserCreation,
        LdapLoginFieldName,
        GitLabButtonText,
        GitLabButtonColor,
        OpenIdButtonText,
        OpenIdButtonColor,
        SamlLoginButtonText,
        EnableCustomBrand,
        CustomBrandText,
        CustomDescriptionText,
        SiteName,
        ExperimentalPrimaryTeam,
        ForgotPasswordLink,
        PasswordEnableForgotLink,
    } = useSelector(getConfig);
    const {IsLicensed} = useSelector(getLicense);
    const initializing = useSelector((state: GlobalState) => state.requests.users.logout.status === RequestStatus.SUCCESS || !state.storage.initialized);
    const currentUser = useSelector(getCurrentUser);
    const experimentalPrimaryTeam = useSelector((state: GlobalState) => (ExperimentalPrimaryTeam ? getTeamByName(state, ExperimentalPrimaryTeam) : undefined));
    const experimentalPrimaryTeamMember = useSelector((state: GlobalState) => (experimentalPrimaryTeam ? getMyTeamMember(state, experimentalPrimaryTeam.id) : undefined));
    const onboardingFlowEnabled = useSelector(getIsOnboardingFlowEnabled);

    const loginIdInput = useRef<HTMLInputElement>(null);
    const passwordInput = useRef<HTMLInputElement>(null);
    const closeSessionExpiredNotification = useRef<() => void>();

    const [loginId, setLoginId] = useState(extraParam === Constants.SIGNIN_VERIFIED && emailParam ? emailParam : '');
    const [password, setPassword] = useState('');
    const [showMfa, setShowMfa] = useState(false);
    const [isWaiting, setIsWaiting] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const [brandImageError, setBrandImageError] = useState(false);
    const [alertBanner, setAlertBanner] = useState<AlertBannerProps | null>(null);
    const [hasError, setHasError] = useState(false);
    const [isMobileView, setIsMobileView] = useState(false);

    const enableCustomBrand = EnableCustomBrand === 'true';
    const enableLdap = EnableLdap === 'true';
    const enableOpenServer = EnableOpenServer === 'true';
    const enableUserCreation = EnableUserCreation === 'true';
    const enableSaml = EnableSaml === 'true';
    const enableSignInWithEmail = EnableSignInWithEmail === 'true';
    const enableSignInWithUsername = EnableSignInWithUsername === 'true';
    const enableSignUpWithEmail = enableUserCreation && EnableSignUpWithEmail === 'true';
    const enableSignUpWithGitLab = EnableSignUpWithGitLab === 'true';
    const enableSignUpWithGoogle = EnableSignUpWithGoogle === 'true';
    const enableSignUpWithOffice365 = EnableSignUpWithOffice365 === 'true';
    const enableSignUpWithOpenId = EnableSignUpWithOpenId === 'true';
    const isLicensed = IsLicensed === 'true';
    const ldapEnabled = isLicensed && enableLdap;
    const enableSignUpWithSaml = isLicensed && enableSaml;
    const siteName = SiteName ?? '';

    const enableBaseLogin = enableSignInWithEmail || enableSignInWithUsername || ldapEnabled;
    const enableExternalSignup = enableSignUpWithGitLab || enableSignUpWithOffice365 || enableSignUpWithGoogle || enableSignUpWithOpenId || enableSignUpWithSaml;
    const showSignup = enableOpenServer && (enableExternalSignup || enableSignUpWithEmail || enableLdap);
    const onlyLdapEnabled = enableLdap && !(enableSaml || enableSignInWithEmail || enableSignInWithUsername || enableSignUpWithEmail || enableSignUpWithGitLab || enableSignUpWithGoogle || enableSignUpWithOffice365 || enableSignUpWithOpenId);

    const query = new URLSearchParams(search);
    const redirectTo = query.get('redirect_to');

    const [desktopLoginLink, setDesktopLoginLink] = useState('');

    const getExternalLoginOptions = () => {
        const externalLoginOptions: ExternalLoginButtonType[] = [];

        if (!enableExternalSignup) {
            return externalLoginOptions;
        }

        if (enableSignUpWithGitLab) {
            const url = `${Client4.getOAuthRoute()}/gitlab/login${search}`;
            externalLoginOptions.push({
                id: 'gitlab',
                url,
                icon: <LoginGitlabIcon/>,
                label: GitLabButtonText || formatMessage({id: 'login.gitlab', defaultMessage: 'GitLab'}),
                style: {color: GitLabButtonColor, borderColor: GitLabButtonColor},
                onClick: desktopExternalAuth(url),
            });
        }

        if (enableSignUpWithGoogle) {
            const url = `${Client4.getOAuthRoute()}/google/login${search}`;
            externalLoginOptions.push({
                id: 'google',
                url,
                icon: <LoginGoogleIcon/>,
                label: formatMessage({id: 'login.google', defaultMessage: 'Google'}),
                onClick: desktopExternalAuth(url),
            });
        }

        if (enableSignUpWithOffice365) {
            const url = `${Client4.getOAuthRoute()}/office365/login${search}`;
            externalLoginOptions.push({
                id: 'office365',
                url,
                icon: <EntraIdIcon/>,
                label: formatMessage({id: 'login.office365', defaultMessage: 'Entra ID'}),
                onClick: desktopExternalAuth(url),
            });
        }

        if (enableSignUpWithOpenId) {
            const url = `${Client4.getOAuthRoute()}/openid/login${search}`;
            externalLoginOptions.push({
                id: 'openid',
                url,
                icon: <LoginOpenIDIcon/>,
                label: OpenIdButtonText || formatMessage({id: 'login.openid', defaultMessage: 'Open ID'}),
                style: {color: OpenIdButtonColor, borderColor: OpenIdButtonColor},
                onClick: desktopExternalAuth(url),
            });
        }

        if (enableSignUpWithSaml) {
            const url = `${Client4.getUrl()}/login/sso/saml${search}`;
            externalLoginOptions.push({
                id: 'saml',
                url,
                icon: <LockIcon/>,
                label: SamlLoginButtonText || formatMessage({id: 'login.saml', defaultMessage: 'SAML'}),
                onClick: desktopExternalAuth(url),
            });
        }

        return externalLoginOptions;
    };

    const desktopExternalAuth = (href: string) => {
        return (event: React.MouseEvent) => {
            if (isDesktopApp()) {
                event.preventDefault();

                setDesktopLoginLink(href);
                history.push(`/login/desktop${search}`);
            }
        };
    };

    const dismissAlert = () => {
        setAlertBanner(null);
        setHasError(false);
    };

    const onDismissSessionExpired = useCallback(() => {
        LocalStorageStore.setWasLoggedIn(false);
        setSessionExpired(false);
        DesktopApp.setSessionExpired(false);
        dismissAlert();
    }, []);

    const configureTitle = useCallback(() => {
        document.title = sessionExpired ? (
            formatMessage(
                {
                    id: 'login.session_expired.title',
                    defaultMessage: '* {siteName} - Session Expired',
                },
                {siteName},
            )
        ) : siteName;
    }, [sessionExpired, siteName]);

    const showSessionExpiredNotificationIfNeeded = useCallback(() => {
        if (sessionExpired && !closeSessionExpiredNotification!.current) {
            dispatch(showNotification({
                title: siteName,
                body: formatMessage({
                    id: 'login.session_expired.notification',
                    defaultMessage: 'Session Expired: Please sign in to continue receiving notifications.',
                }),
                requireInteraction: true,
                silent: false,
                onClick: () => {
                    window.focus();
                    if (closeSessionExpiredNotification.current) {
                        closeSessionExpiredNotification.current();
                        closeSessionExpiredNotification.current = undefined;
                    }
                },
            })).then(({callback: closeNotification}) => {
                closeSessionExpiredNotification.current = closeNotification;
            }).catch(() => {
                // Ignore the failure to display the notification.
            });
        } else if (!sessionExpired && closeSessionExpiredNotification!.current) {
            closeSessionExpiredNotification.current();
            closeSessionExpiredNotification.current = undefined;
        }
    }, [sessionExpired, siteName]);

    const getAlertData = useCallback(() => {
        let mode;
        let title;
        let onDismiss;

        if (sessionExpired) {
            mode = 'warning';
            title = formatMessage({
                id: 'login.session_expired',
                defaultMessage: 'Your session has expired. Please log in again.',
            });
            onDismiss = onDismissSessionExpired;
        } else {
            switch (extraParam) {
            case Constants.GET_TERMS_ERROR:
                mode = 'danger';
                title = formatMessage({
                    id: 'login.get_terms_error',
                    defaultMessage: 'Unable to load terms of service. If this issue persists, contact your System Administrator.',
                });
                break;

            case Constants.TERMS_REJECTED:
                mode = 'warning';
                title = formatMessage(
                    {
                        id: 'login.terms_rejected',
                        defaultMessage: 'You must agree to the terms of use before accessing {siteName}. Please contact your System Administrator for more details.',
                    },
                    {siteName},
                );
                break;

            case Constants.SIGNIN_CHANGE:
                mode = 'success';
                title = formatMessage({
                    id: 'login.changed',
                    defaultMessage: 'Sign-in method changed successfully',
                });
                break;

            case Constants.SIGNIN_VERIFIED:
                mode = 'success';
                title = formatMessage({
                    id: 'login.verified',
                    defaultMessage: 'Email Verified',
                });
                break;

            case Constants.PASSWORD_CHANGE:
                mode = 'success';
                title = formatMessage({
                    id: 'login.passwordChanged',
                    defaultMessage: 'Password updated successfully',
                });
                break;

            case Constants.CREATE_LDAP:
                mode = 'success';
                title = formatMessage({
                    id: 'login.ldapCreate',
                    defaultMessage: 'Enter your AD/LDAP username and password to create an account.',
                });
                break;

            default:
                break;
            }
        }

        return setAlertBanner(mode ? {mode: mode as ModeType, title, onDismiss} : null);
    }, [extraParam, sessionExpired, siteName, onDismissSessionExpired]);

    const getAlternateLink = useCallback(() => {
        const linkLabel = formatMessage({
            id: 'login.noAccount',
            defaultMessage: 'Don\'t have an account?',
        });
        const handleClick = () => {
            trackEvent('signup', 'click_login_no_account');
        };
        if (showSignup) {
            return (
                <AlternateLinkLayout
                    className='login-body-alternate-link'
                    alternateLinkPath={'/signup_user_complete'}
                    alternateLinkLabel={linkLabel}
                />
            );
        }
        return (
            <AlternateLinkLayout
                className='login-body-alternate-link'
                alternateLinkPath={'/access_problem'}
                alternateLinkLabel={linkLabel}
                onClick={handleClick}
            />
        );
    }, [showSignup]);

    const onWindowResize = throttle(() => {
        setIsMobileView(window.innerWidth < MOBILE_SCREEN_WIDTH);
    }, 100);

    const onWindowFocus = useCallback(() => {
        if (extraParam === Constants.SIGNIN_VERIFIED && emailParam) {
            passwordInput.current?.focus();
        }
    }, [emailParam, extraParam]);

    useEffect(() => {
        if (onCustomizeHeader) {
            onCustomizeHeader({
                onBackButtonClick: showMfa ? handleHeaderBackButtonOnClick : undefined,
                alternateLink: isMobileView ? getAlternateLink() : undefined,
            });
        }
    }, [onCustomizeHeader, search, showMfa, isMobileView, getAlternateLink]);

    useEffect(() => {
        // We don't want to redirect outside of this route if we're doing Desktop App auth
        if (query.get('server_token')) {
            return;
        }

        if (currentUser) {
            if (redirectTo && redirectTo.match(/^\/([^/]|$)/)) {
                history.push(redirectTo);
                return;
            }
            redirectUserToDefaultTeam();
            return;
        }

        onWindowResize();
        onWindowFocus();

        window.addEventListener('resize', onWindowResize);
        window.addEventListener('focus', onWindowFocus);

        // Determine if the user was unexpectedly logged out.
        if (LocalStorageStore.getWasLoggedIn()) {
            if (extraParam === Constants.SIGNIN_CHANGE) {
                // Assume that if the user triggered a sign in change, it was intended to logout.
                // We can't preflight this, since in some flows it's the server that invalidates
                // our session after we use it to complete the sign in change.
                LocalStorageStore.setWasLoggedIn(false);
            } else {
                setSessionExpired(true);
                DesktopApp.setSessionExpired(true);

                // Although the authority remains the local sessionExpired bit on the state, set this
                // extra field in the querystring to signal the desktop app.
                // This is legacy support for older Desktop Apps and can be removed eventually
                const newSearchParam = new URLSearchParams(search);
                newSearchParam.set('extra', Constants.SESSION_EXPIRED);
                history.replace(`${pathname}?${newSearchParam}`);
            }
        }
    }, []);

    useEffect(() => {
        configureTitle();
        showSessionExpiredNotificationIfNeeded();
        getAlertData();
    }, [configureTitle, showSessionExpiredNotificationIfNeeded, getAlertData]);

    useEffect(() => {
        return () => {
            if (closeSessionExpiredNotification!.current) {
                closeSessionExpiredNotification.current();
                closeSessionExpiredNotification.current = undefined;
            }

            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('focus', onWindowFocus);

            DesktopApp.setSessionExpired(false);
        };
    }, []);

    if (initializing) {
        return (<LoadingScreen/>);
    }

    const getInputPlaceholder = () => {
        const loginPlaceholders = [];

        if (enableSignInWithEmail) {
            loginPlaceholders.push(formatMessage({id: 'login.email', defaultMessage: 'Email'}));
        }

        if (enableSignInWithUsername) {
            loginPlaceholders.push(formatMessage({id: 'login.username', defaultMessage: 'Username'}));
        }

        if (ldapEnabled) {
            loginPlaceholders.push(LdapLoginFieldName || formatMessage({id: 'login.ldapUsername', defaultMessage: 'AD/LDAP Username'}));
        }

        if (loginPlaceholders.length > 1) {
            const lastIndex = loginPlaceholders.length - 1;
            return `${loginPlaceholders.slice(0, lastIndex).join(', ')}${formatMessage({id: 'login.placeholderOr', defaultMessage: ' or '})}${loginPlaceholders[lastIndex]}`;
        }

        return loginPlaceholders[0] ?? '';
    };

    const preSubmit = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        setIsWaiting(true);

        // Discard any session expiry notice once the user interacts with the login page.
        onDismissSessionExpired();

        const newQuery = search.replace(/(extra=password_change)&?/i, '');
        if (newQuery !== search) {
            history.replace(`${pathname}${newQuery}${hash}`);
        }

        // password managers don't always call onInput handlers for form fields so it's possible
        // for the state to get out of sync with what the user sees in the browser
        let currentLoginId = loginId;
        if (loginIdInput.current) {
            currentLoginId = loginIdInput.current.value;

            if (currentLoginId !== loginId) {
                setLoginId(currentLoginId);
            }
        }

        let currentPassword = password;
        if (passwordInput.current) {
            currentPassword = passwordInput.current.value;

            if (currentPassword !== password) {
                setPassword(currentPassword);
            }
        }

        // don't trim the password since we support spaces in passwords
        currentLoginId = currentLoginId.trim().toLowerCase();

        if (!currentLoginId) {
            t('login.noEmail');
            t('login.noEmailLdapUsername');
            t('login.noEmailUsername');
            t('login.noEmailUsernameLdapUsername');
            t('login.noLdapUsername');
            t('login.noUsername');
            t('login.noUsernameLdapUsername');

            // it's slightly weird to be constructing the message ID, but it's a bit nicer than triply nested if statements
            let msgId = 'login.no';
            if (enableSignInWithEmail) {
                msgId += 'Email';
            }
            if (enableSignInWithUsername) {
                msgId += 'Username';
            }
            if (ldapEnabled) {
                msgId += 'LdapUsername';
            }

            setAlertBanner({
                mode: 'danger',
                title: formatMessage(
                    {id: msgId},
                    {ldapUsername: LdapLoginFieldName || formatMessage({id: 'login.ldapUsernameLower', defaultMessage: 'AD/LDAP username'})},
                ),
            });
            setHasError(true);
            setIsWaiting(false);

            return;
        }

        if (!password) {
            setAlertBanner({
                mode: 'danger',
                title: formatMessage({id: 'login.noPassword', defaultMessage: 'Please enter your password'}),
            });
            setHasError(true);
            setIsWaiting(false);

            return;
        }

        submit({loginId, password});
    };

    const submit = async ({loginId, password, token}: SubmitOptions) => {
        setIsWaiting(true);

        const {error: loginError} = await dispatch(login(loginId, password, token));

        if (loginError && loginError.server_error_id && loginError.server_error_id.length !== 0) {
            if (loginError.server_error_id === 'api.user.login.not_verified.app_error') {
                history.push('/should_verify_email?&email=' + encodeURIComponent(loginId));
            } else if (loginError.server_error_id === 'store.sql_user.get_for_login.app_error' ||
                loginError.server_error_id === 'ent.ldap.do_login.user_not_registered.app_error') {
                setShowMfa(false);
                setIsWaiting(false);
                setAlertBanner({
                    mode: 'danger',
                    title: formatMessage({
                        id: 'login.userNotFound',
                        defaultMessage: "We couldn't find an account matching your login credentials.",
                    }),
                });
                setHasError(true);
            } else if (loginError.server_error_id === 'api.user.check_user_password.invalid.app_error' ||
                loginError.server_error_id === 'ent.ldap.do_login.invalid_password.app_error') {
                setShowMfa(false);
                setIsWaiting(false);
                setAlertBanner({
                    mode: 'danger',
                    title: formatMessage({
                        id: 'login.invalidPassword',
                        defaultMessage: 'Your password is incorrect.',
                    }),
                });
                setHasError(true);
            } else if (!showMfa && loginError.server_error_id === 'mfa.validate_token.authenticate.app_error') {
                setShowMfa(true);
            } else if (loginError.server_error_id === 'api.user.login.invalid_credentials_email_username') {
                setShowMfa(false);
                setIsWaiting(false);
                setAlertBanner({
                    mode: 'danger',
                    title: formatMessage({
                        id: 'login.invalidCredentials',
                        defaultMessage: 'The email/username or password is invalid.',
                    }),
                });
                setHasError(true);
            } else {
                setShowMfa(false);
                setIsWaiting(false);
                setAlertBanner({
                    mode: 'danger',
                    title: loginError.message,
                });
                setHasError(true);
            }
            return;
        }

        await postSubmit();
    };

    const postSubmit = async () => {
        await dispatch(loadMe());

        // check for query params brought over from signup_user_complete
        const params = new URLSearchParams(search);
        const inviteToken = params.get('t') || '';
        const inviteId = params.get('id') || '';

        if (inviteId || inviteToken) {
            const {data: team} = await dispatch(addUserToTeamFromInvite(inviteToken, inviteId));

            if (team) {
                finishSignin(team);
            } else {
                // there's not really a good way to deal with this, so just let the user log in like normal
                finishSignin();
            }
        } else {
            finishSignin();
        }
    };

    const finishSignin = (team?: Team) => {
        setCSRFFromCookie();

        // Record a successful login to local storage. If an unintentional logout occurs, e.g.
        // via session expiration, this bit won't get reset and we can notify the user as such.
        LocalStorageStore.setWasLoggedIn(true);

        // After a user has just logged in, we set the following flag to "false" so that after
        // a user is notified of successful login, we can set it back to "true"
        LocalStorageStore.setWasNotifiedOfLogIn(false);

        if (redirectTo && redirectTo.match(/^\/([^/]|$)/)) {
            history.push(redirectTo);
        } else if (team) {
            history.push(`/${team.name}`);
        } else if (experimentalPrimaryTeamMember?.team_id) {
            // Only set experimental team if user is on that team
            history.push(`/${ExperimentalPrimaryTeam}`);
        } else if (onboardingFlowEnabled) {
            // need info about whether admin or not,
            // and whether admin has already completed
            // first time onboarding. Instead of fetching and orchestrating that here,
            // let the default root component handle it.
            history.push('/');
        } else {
            redirectUserToDefaultTeam();
        }
    };

    const handleHeaderBackButtonOnClick = () => {
        setShowMfa(false);
    };

    const handleInputOnChange = ({target: {value: loginId}}: React.ChangeEvent<HTMLInputElement>) => {
        setLoginId(loginId);

        if (hasError) {
            setHasError(false);
            dismissAlert();
        }
    };

    const handlePasswordInputOnChange = ({target: {value: password}}: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(password);

        if (hasError) {
            setHasError(false);
            dismissAlert();
        }
    };

    const handleBrandImageError = () => {
        setBrandImageError(true);
    };

    const getCardTitle = () => {
        if (CustomDescriptionText) {
            return CustomDescriptionText;
        }

        if (!enableBaseLogin && enableExternalSignup) {
            return formatMessage({id: 'login.cardtitle.external', defaultMessage: 'Log in with one of the following:'});
        }

        return formatMessage({id: 'login.cardtitle', defaultMessage: 'Log in'});
    };

    const getMessageSubtitle = () => {
        if (enableCustomBrand) {
            return CustomBrandText ? (
                <div className='login-body-custom-branding-markdown'>
                    <Markdown
                        message={CustomBrandText}
                        options={{mentionHighlight: false}}
                    />
                </div>
            ) : null;
        }

        return (
            <p className='login-body-message-subtitle'>
                {formatMessage({id: 'login.subtitle', defaultMessage: 'Collaborate with your team in real-time'})}
            </p>
        );
    };

    const getResetPasswordLink = () => {
        if (!PasswordEnableForgotLink || PasswordEnableForgotLink === 'false' || onlyLdapEnabled) {
            return null;
        }

        if (ForgotPasswordLink) {
            return (
                <div className='login-body-card-form-link'>
                    <ExternalLink
                        location='login_page'
                        href={ForgotPasswordLink}
                    >
                        {formatMessage({id: 'login.forgot', defaultMessage: 'Forgot your password?'})}
                    </ExternalLink>
                </div>
            );
        }

        if (enableSignInWithUsername || enableSignInWithEmail) {
            return (
                <div className='login-body-card-form-link'>
                    <Link to='/reset_password'>
                        {formatMessage({id: 'login.forgot', defaultMessage: 'Forgot your password?'})}
                    </Link>
                </div>
            );
        }

        return null;
    };

    const getContent = () => {
        if (showMfa) {
            return (
                <LoginMfa
                    loginId={loginId}
                    password={password}
                    onSubmit={submit}
                />
            );
        }

        if (!enableBaseLogin && !enableExternalSignup) {
            return (
                <ColumnLayout
                    title={formatMessage({id: 'login.noMethods.title', defaultMessage: 'This server doesn’t have any sign-in methods enabled'})}
                    message={formatMessage({id: 'login.noMethods.subtitle', defaultMessage: 'Please contact your System Administrator to resolve this.'})}
                />
            );
        }

        if (desktopLoginLink || query.get('server_token')) {
            return (
                <Route
                    path={'/login/desktop'}
                    render={() => (
                        <DesktopAuthToken
                            href={desktopLoginLink}
                            onLogin={postSubmit}
                        />
                    )}
                />
            );
        }

        return (
            <>
                <div
                    className={classNames(
                        'login-body-message',
                        {
                            'custom-branding': enableCustomBrand,
                            'with-brand-image': enableCustomBrand && !brandImageError,
                            'with-alternate-link': showSignup && !isMobileView,
                        },
                    )}
                >
                    {enableCustomBrand && !brandImageError ? (
                        <img
                            className={classNames('login-body-custom-branding-image')}
                            alt='brand'
                            src={Client4.getBrandImageUrl('0')}
                            onError={handleBrandImageError}
                        />
                    ) : (
                        <h1 className='login-body-message-title'>
                            {formatMessage({id: 'login.title', defaultMessage: 'Log in to your account'})}
                        </h1>
                    )}
                    {getMessageSubtitle()}
                </div>
                <div className='login-body-action'>
                    {!isMobileView && getAlternateLink()}
                    <div className={classNames('login-body-card', {'custom-branding': enableCustomBrand, 'with-error': hasError})}>
                        <div
                            className='login-body-card-content'
                            tabIndex={0}
                        >
                            <p className='login-body-card-title'>
                                {getCardTitle()}
                            </p>
                            {enableCustomBrand && getMessageSubtitle()}
                            {alertBanner && (
                                <AlertBanner
                                    className='login-body-card-banner'
                                    mode={alertBanner.mode}
                                    title={alertBanner.title}
                                    onDismiss={alertBanner.onDismiss ?? dismissAlert}
                                />
                            )}
                            {enableBaseLogin && (
                                <form
                                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                                        preSubmit(event as unknown as React.MouseEvent);
                                    }}
                                >
                                    <div className='login-body-card-form'>
                                        <Input
                                            ref={loginIdInput}
                                            name='loginId'
                                            containerClassName='login-body-card-form-input'
                                            type='text'
                                            inputSize={SIZE.LARGE}
                                            value={loginId}
                                            onChange={handleInputOnChange}
                                            hasError={hasError}
                                            placeholder={getInputPlaceholder()}
                                            disabled={isWaiting}
                                            autoFocus={true}
                                        />
                                        <PasswordInput
                                            ref={passwordInput}
                                            className='login-body-card-form-password-input'
                                            value={password}
                                            inputSize={SIZE.LARGE}
                                            onChange={handlePasswordInputOnChange}
                                            hasError={hasError}
                                            disabled={isWaiting}
                                        />
                                        {getResetPasswordLink()}
                                        <SaveButton
                                            extraClasses='login-body-card-form-button-submit large'
                                            saving={isWaiting}
                                            onClick={preSubmit}
                                            defaultMessage={formatMessage({id: 'login.logIn', defaultMessage: 'Log in'})}
                                            savingMessage={formatMessage({id: 'login.logingIn', defaultMessage: 'Logging in…'})}
                                        />
                                    </div>
                                </form>
                            )}
                            {enableBaseLogin && enableExternalSignup && (
                                <div className='login-body-card-form-divider'>
                                    <span className='login-body-card-form-divider-label'>
                                        {formatMessage({id: 'login.or', defaultMessage: 'or log in with'})}
                                    </span>
                                </div>
                            )}
                            {enableExternalSignup && (
                                <div className={classNames('login-body-card-form-login-options', {column: !enableBaseLogin})}>
                                    {getExternalLoginOptions().map((option) => (
                                        <ExternalLoginButton
                                            key={option.id}
                                            direction={enableBaseLogin ? undefined : 'column'}
                                            {...option}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className='login-body'>
            <div className='login-body-content'>
                {getContent()}
            </div>
        </div>
    );
};

export default Login;
