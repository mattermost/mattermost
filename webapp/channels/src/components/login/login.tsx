// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useRef, useCallback, FormEvent} from 'react';
import {useIntl} from 'react-intl';
import {Link, useLocation, useHistory} from 'react-router-dom';
import {useSelector, useDispatch} from 'react-redux';
import classNames from 'classnames';
import throttle from 'lodash/throttle';

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getIsOnboardingFlowEnabled, isGraphQLEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getTeamByName, getMyTeamMember} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {isSystemAdmin} from 'mattermost-redux/utils/user_utils';

import {isCurrentLicenseCloud} from 'mattermost-redux/selectors/entities/cloud';
import {RequestStatus} from 'mattermost-redux/constants';
import {DispatchFunc} from 'mattermost-redux/types/actions';
import {loadMe, loadMeREST} from 'mattermost-redux/actions/users';

import LocalStorageStore from 'stores/local_storage_store';

import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {addUserToTeamFromInvite} from 'actions/team_actions';
import {login, loginWithDesktopToken} from 'actions/views/login';
import {setNeedsLoggedInLimitReachedCheck} from 'actions/views/admin';
import {trackEvent} from 'actions/telemetry_actions';

import AlertBanner, {ModeType, AlertBannerProps} from 'components/alert_banner';
import DesktopAuthToken from 'components/desktop_auth_token';
import ExternalLoginButton, {ExternalLoginButtonType} from 'components/external_login_button/external_login_button';
import AlternateLinkLayout from 'components/header_footer_route/content_layouts/alternate_link';
import ColumnLayout from 'components/header_footer_route/content_layouts/column';
import {CustomizeHeaderType} from 'components/header_footer_route/header_footer_route';
import LoadingScreen from 'components/loading_screen';
import Markdown from 'components/markdown';
import SaveButton from 'components/save_button';
import LockIcon from 'components/widgets/icons/lock_icon';
import LoginGoogleIcon from 'components/widgets/icons/login_google_icon';
import LoginGitlabIcon from 'components/widgets/icons/login_gitlab_icon';
import LoginOffice365Icon from 'components/widgets/icons/login_office_365_icon';
import LoginOpenIDIcon from 'components/widgets/icons/login_openid_icon';
import Input, {SIZE} from 'components/widgets/inputs/input/input';
import PasswordInput from 'components/widgets/inputs/password_input/password_input';
import WomanWithChatsSVG from 'components/common/svg_images_components/woman_with_chats_svg';
import {SubmitOptions} from 'components/claim/components/email_to_ldap';

import {GlobalState} from 'types/store';

import Constants from 'utils/constants';
import {showNotification} from 'utils/notifications';
import {t} from 'utils/i18n';
import {setCSRFFromCookie} from 'utils/utils';

import LoginMfa from './login_mfa';

import './login.scss';
import {isDesktopApp} from 'utils/user_agent';
import {DesktopAuthStatus, generateDesktopToken, getExternalLoginURL} from 'utils/desktop_app/auth';

const MOBILE_SCREEN_WIDTH = 1200;

type LoginProps = {
    onCustomizeHeader?: CustomizeHeaderType;
}

const Login = ({onCustomizeHeader}: LoginProps) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
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
        SiteURL,
    } = useSelector(getConfig);
    const {IsLicensed} = useSelector(getLicense);
    const initializing = useSelector((state: GlobalState) => state.requests.users.logout.status === RequestStatus.SUCCESS || !state.storage.initialized);
    const currentUser = useSelector(getCurrentUser);
    const experimentalPrimaryTeam = useSelector((state: GlobalState) => (ExperimentalPrimaryTeam ? getTeamByName(state, ExperimentalPrimaryTeam) : undefined));
    const experimentalPrimaryTeamMember = useSelector((state: GlobalState) => getMyTeamMember(state, experimentalPrimaryTeam?.id ?? ''));
    const onboardingFlowEnabled = useSelector(getIsOnboardingFlowEnabled);
    const isCloud = useSelector(isCurrentLicenseCloud);
    const graphQLEnabled = useSelector(isGraphQLEnabled);

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
    const enableSaml = EnableSaml === 'true';
    const enableSignInWithEmail = EnableSignInWithEmail === 'true';
    const enableSignInWithUsername = EnableSignInWithUsername === 'true';
    const enableSignUpWithEmail = EnableSignUpWithEmail === 'true';
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

    const query = new URLSearchParams(search);
    const redirectTo = query.get('redirect_to');

    const [desktopToken, setDesktopToken] = useState('');
    const [desktopAuthLogin, setDesktopAuthLogin] = useState(query.get('desktopAuthStatus') === 'complete' ? DesktopAuthStatus.Complete : DesktopAuthStatus.None);
    const desktopAuthInterval = useRef<number>();

    const getExternalURL = (url: string) => getExternalLoginURL(url, search, desktopToken);

    const getExternalLoginOptions = () => {
        const externalLoginOptions: ExternalLoginButtonType[] = [];

        if (!enableExternalSignup) {
            return externalLoginOptions;
        }

        if (enableSignUpWithGitLab) {
            externalLoginOptions.push({
                id: 'gitlab',
                url: getExternalURL(`${Client4.getOAuthRoute()}/gitlab/login`),
                icon: <LoginGitlabIcon/>,
                label: GitLabButtonText || formatMessage({id: 'login.gitlab', defaultMessage: 'GitLab'}),
                style: {color: GitLabButtonColor, borderColor: GitLabButtonColor},
            });
        }

        if (enableSignUpWithGoogle) {
            externalLoginOptions.push({
                id: 'google',
                url: getExternalURL(`${Client4.getOAuthRoute()}/google/login`),
                icon: <LoginGoogleIcon/>,
                label: formatMessage({id: 'login.google', defaultMessage: 'Google'}),
            });
        }

        if (enableSignUpWithOffice365) {
            externalLoginOptions.push({
                id: 'office365',
                url: getExternalURL(`${Client4.getOAuthRoute()}/office365/login`),
                icon: <LoginOffice365Icon/>,
                label: formatMessage({id: 'login.office365', defaultMessage: 'Office 365'}),
            });
        }

        if (enableSignUpWithOpenId) {
            externalLoginOptions.push({
                id: 'openid',
                url: getExternalURL(`${Client4.getOAuthRoute()}/openid/login`),
                icon: <LoginOpenIDIcon/>,
                label: OpenIdButtonText || formatMessage({id: 'login.openid', defaultMessage: 'Open ID'}),
                style: {color: OpenIdButtonColor, borderColor: OpenIdButtonColor},
            });
        }

        if (enableSignUpWithSaml) {
            externalLoginOptions.push({
                id: 'saml',
                url: getExternalURL(`${Client4.getUrl()}/login/sso/saml`),
                icon: <LockIcon/>,
                label: SamlLoginButtonText || formatMessage({id: 'login.saml', defaultMessage: 'SAML'}),
            });
        }

        return externalLoginOptions;
    };

    const desktopExternalAuth = () => {
        if (isDesktopApp()) {
            setDesktopAuthLogin(DesktopAuthStatus.Polling);

            desktopAuthInterval.current = setInterval(tryDesktopLogin, 2000) as unknown as number;
        }
    };

    const tryDesktopLogin = async () => {
        const {data: userProfile, error: loginError} = await dispatch(loginWithDesktopToken(desktopToken));

        if (loginError && loginError.server_error_id && loginError.server_error_id.length !== 0) {
            if (loginError.server_error_id === 'app.desktop_token.validate.expired') {
                clearInterval(desktopAuthInterval.current);
                setDesktopAuthLogin(DesktopAuthStatus.Expired);
            }
            return;
        }

        clearInterval(desktopAuthInterval.current);
        setDesktopAuthLogin(DesktopAuthStatus.Complete);
        await postSubmit(userProfile);
    };

    const dismissAlert = () => {
        setAlertBanner(null);
        setHasError(false);
    };

    const onDismissSessionExpired = useCallback(() => {
        LocalStorageStore.setWasLoggedIn(false);
        setSessionExpired(false);
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
            showNotification({
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
            }).then((closeNotification) => {
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
        } else {
            loginIdInput.current?.focus();
        }
    }, [emailParam, extraParam]);

    const openDesktopApp = () => {
        if (!SiteURL) {
            return;
        }
        const url = new URL(SiteURL);
        if (redirectTo) {
            url.pathname += redirectTo;
        }
        url.protocol = 'mattermost';
        window.location.href = url.toString();
    };

    useEffect(() => {
        if (onCustomizeHeader) {
            onCustomizeHeader({
                onBackButtonClick: showMfa ? handleHeaderBackButtonOnClick : undefined,
                alternateLink: isMobileView ? getAlternateLink() : undefined,
            });
        }
    }, [onCustomizeHeader, search, showMfa, isMobileView, getAlternateLink]);

    useEffect(() => {
        if (desktopAuthLogin === DesktopAuthStatus.Complete) {
            openDesktopApp();
            return;
        }

        if (isDesktopApp()) {
            setDesktopToken(generateDesktopToken());
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
                // Although the authority remains the local sessionExpired bit on the state, set this
                // extra field in the querystring to signal the desktop app.
                setSessionExpired(true);
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
            if (desktopAuthInterval.current) {
                clearInterval(desktopAuthInterval.current);

                // Attempt to make a final call to log in if not already logged in
                if (!currentUser) {
                    dispatch(loginWithDesktopToken(desktopToken));
                }
            }

            if (closeSessionExpiredNotification!.current) {
                closeSessionExpiredNotification.current();
                closeSessionExpiredNotification.current = undefined;
            }

            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('focus', onWindowFocus);
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

        const {data: userProfile, error: loginError} = await dispatch(login(loginId, password, token));

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

        await postSubmit(userProfile);
    };

    const postSubmit = async (userProfile: UserProfile) => {
        if (graphQLEnabled) {
            await dispatch(loadMe());
        } else {
            await dispatch(loadMeREST());
        }

        // check for query params brought over from signup_user_complete
        const params = new URLSearchParams(search);
        const inviteToken = params.get('t') || '';
        const inviteId = params.get('id') || '';

        if (inviteId || inviteToken) {
            const {data: team} = await dispatch(addUserToTeamFromInvite(inviteToken, inviteId));

            if (team) {
                finishSignin(userProfile, team);
            } else {
                // there's not really a good way to deal with this, so just let the user log in like normal
                finishSignin(userProfile);
            }
        } else {
            finishSignin(userProfile);
        }
    };

    const finishSignin = (userProfile: UserProfile, team?: Team) => {
        if (isCloud && isSystemAdmin(userProfile.roles)) {
            dispatch(setNeedsLoggedInLimitReachedCheck(true));
        }

        setCSRFFromCookie();

        // Record a successful login to local storage. If an unintentional logout occurs, e.g.
        // via session expiration, this bit won't get reset and we can notify the user as such.
        LocalStorageStore.setWasLoggedIn(true);
        if (redirectTo && redirectTo.match(/^\/([^/]|$)/)) {
            history.push(redirectTo);
        } else if (team) {
            history.push(`/${team.name}`);
        } else if (experimentalPrimaryTeamMember.team_id) {
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

        if (desktopAuthLogin) {
            return (
                <DesktopAuthToken
                    authStatus={desktopAuthLogin}
                    onComplete={openDesktopApp}
                    onLogin={tryDesktopLogin}
                    onRestart={() => history.push('/')}
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
                            alt='brand image'
                            src={Client4.getBrandImageUrl('0')}
                            onError={handleBrandImageError}
                        />
                    ) : (
                        <h1 className='login-body-message-title'>
                            {formatMessage({id: 'login.title', defaultMessage: 'Log in to your account'})}
                        </h1>
                    )}
                    {getMessageSubtitle()}
                    {!enableCustomBrand && (
                        <div className='login-body-message-svg'>
                            <WomanWithChatsSVG width={270}/>
                        </div>
                    )}
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
                                        {(enableSignInWithUsername || enableSignInWithEmail) && (
                                            <div className='login-body-card-form-link'>
                                                <Link to='/reset_password'>
                                                    {formatMessage({id: 'login.forgot', defaultMessage: 'Forgot your password?'})}
                                                </Link>
                                            </div>
                                        )}
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
                                            onClick={desktopExternalAuth}
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
