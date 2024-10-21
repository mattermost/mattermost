// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import noop from 'lodash/noop';
import throttle from 'lodash/throttle';
import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import type {FocusEvent} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';
import {useLocation, useHistory, Route} from 'react-router-dom';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {getTeamInviteInfo} from 'mattermost-redux/actions/teams';
import {createUser, loadMe} from 'mattermost-redux/actions/users';
import {Client4} from 'mattermost-redux/client';
import {getConfig, getLicense, getPasswordConfig} from 'mattermost-redux/selectors/entities/general';
import {getIsOnboardingFlowEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {isEmail} from 'mattermost-redux/utils/helpers';

import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {removeGlobalItem, setGlobalItem} from 'actions/storage';
import {addUserToTeamFromInvite} from 'actions/team_actions';
import {trackEvent} from 'actions/telemetry_actions.jsx';
import {loginById} from 'actions/views/login';
import {getGlobalItem} from 'selectors/storage';

import AlertBanner from 'components/alert_banner';
import type {ModeType, AlertBannerProps} from 'components/alert_banner';
import useCWSAvailabilityCheck, {CSWAvailabilityCheckTypes} from 'components/common/hooks/useCWSAvailabilityCheck';
import LaptopAlertSVG from 'components/common/svg_images_components/laptop_alert_svg';
import ManWithLaptopSVG from 'components/common/svg_images_components/man_with_laptop_svg';
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
import CheckInput from 'components/widgets/inputs/check';
import Input, {SIZE} from 'components/widgets/inputs/input/input';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';
import PasswordInput from 'components/widgets/inputs/password_input/password_input';

import {Constants, HostedCustomerLinks, ItemStatus, ValidationErrors} from 'utils/constants';
import {isValidPassword} from 'utils/password';
import {isDesktopApp} from 'utils/user_agent';
import {isValidUsername, getRoleFromTrackFlow, getMediumFromTrackFlow} from 'utils/utils';

import type {GlobalState} from 'types/store';

import './signup.scss';

const MOBILE_SCREEN_WIDTH = 1200;

type SignupProps = {
    onCustomizeHeader?: CustomizeHeaderType;
}

const laptopAlertIcon = <LaptopAlertSVG/>;
const gitlabIcon = <LoginGitlabIcon/>;
const googleIcon = <LoginGoogleIcon/>;
const entraIcon = <EntraIdIcon/>;
const openIDIcon = <LoginOpenIDIcon/>;
const lockIcon = <LockIcon/>;

const markdownOptions = {mentionHighlight: false};

function sendSignUpTelemetryEvents(telemetryId: string, props?: any) {
    trackEvent('signup', telemetryId, props);
}

const handleOnBlur = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>, inputId: string) => {
    const text = e.target.value;
    if (!text) {
        return;
    }
    sendSignUpTelemetryEvents(`typed_input_${inputId}`);
};

const onBlurPassword = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => handleOnBlur(e, 'password');
const onBlurNameInput = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => handleOnBlur(e, 'username');
const onBlurEmailInput = (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => handleOnBlur(e, 'email');

const Signup = ({onCustomizeHeader}: SignupProps) => {
    const intl = useIntl();
    const {formatMessage} = intl;
    const dispatch = useDispatch();
    const history = useHistory();
    const {search} = useLocation();

    const params = new URLSearchParams(search);
    const token = params.get('t') ?? '';
    const inviteId = params.get('id') ?? '';
    const data = params.get('d');
    const parsedData: Record<string, string> = data ? JSON.parse(data) : {};
    const {email: parsedEmail, name: parsedTeamName, reminder_interval: reminderInterval} = parsedData;

    const config = useSelector(getConfig);
    const {
        EnableOpenServer,
        EnableUserCreation,
        NoAccounts,
        EnableSignUpWithEmail,
        EnableSignUpWithGitLab,
        EnableSignUpWithGoogle,
        EnableSignUpWithOffice365,
        EnableSignUpWithOpenId,
        EnableLdap,
        EnableSaml,
        SamlLoginButtonText,
        LdapLoginFieldName,
        SiteName,
        CustomDescriptionText,
        GitLabButtonText,
        GitLabButtonColor,
        OpenIdButtonText,
        OpenIdButtonColor,
        EnableCustomBrand,
        CustomBrandText,
        TermsOfServiceLink,
        PrivacyPolicyLink,
    } = config;
    const {IsLicensed} = useSelector(getLicense);
    const loggedIn = Boolean(useSelector(getCurrentUserId));
    const onboardingFlowEnabled = useSelector(getIsOnboardingFlowEnabled);
    const usedBefore = useSelector((state: GlobalState) => (!inviteId && !loggedIn && token ? getGlobalItem(state, token, null) : undefined));

    const emailInput = useRef<HTMLInputElement>(null);
    const nameInput = useRef<HTMLInputElement>(null);
    const passwordInput = useRef<HTMLInputElement>(null);

    const isLicensed = IsLicensed === 'true';
    const enableOpenServer = EnableOpenServer === 'true';
    const enableUserCreation = EnableUserCreation === 'true';
    const noAccounts = NoAccounts === 'true';
    const enableSignUpWithEmail = enableUserCreation && EnableSignUpWithEmail === 'true';
    const enableSignUpWithGitLab = enableUserCreation && EnableSignUpWithGitLab === 'true';
    const enableSignUpWithGoogle = enableUserCreation && EnableSignUpWithGoogle === 'true';
    const enableSignUpWithOffice365 = enableUserCreation && EnableSignUpWithOffice365 === 'true';
    const enableSignUpWithOpenId = enableUserCreation && EnableSignUpWithOpenId === 'true';
    const enableLDAP = EnableLdap === 'true';
    const enableSAML = EnableSaml === 'true';
    const enableCustomBrand = EnableCustomBrand === 'true';

    const noOpenServer = !inviteId && !token && !enableOpenServer && !noAccounts && !enableUserCreation;

    const [email, setEmail] = useState(parsedEmail ?? '');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(Boolean(inviteId));
    const [isWaiting, setIsWaiting] = useState(false);
    const [emailError, setEmailError] = useState('');
    const [nameError, setNameError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [brandImageError, setBrandImageError] = useState(false);
    const [serverError, setServerError] = useState('');
    const [teamName, setTeamName] = useState(parsedTeamName ?? '');
    const [alertBanner, setAlertBanner] = useState<AlertBannerProps | null>(null);
    const [isMobileView, setIsMobileView] = useState(false);
    const [subscribeToSecurityNewsletter, setSubscribeToSecurityNewsletter] = useState(false);

    const cwsAvailability = useCWSAvailabilityCheck();

    const enableExternalSignup = enableSignUpWithGitLab || enableSignUpWithOffice365 || enableSignUpWithGoogle || enableSignUpWithOpenId || enableLDAP || enableSAML;
    const hasError = Boolean(emailError || nameError || passwordError || serverError || alertBanner);
    const canSubmit = Boolean(email && name && password) && !hasError && !loading;
    const passwordConfig = useSelector(getPasswordConfig);
    const {error: passwordInfo} = useMemo(() => isValidPassword('', passwordConfig, intl), [intl, passwordConfig]);

    const [desktopLoginLink, setDesktopLoginLink] = useState('');

    const subscribeToSecurityNewsletterFunc = useCallback(() => {
        try {
            Client4.subscribeToNewsletter({email, subscribed_content: 'security_newsletter'});
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error(error);
        }
    }, [email]);

    const desktopExternalAuth = useCallback((href: string) => {
        return (event: React.MouseEvent) => {
            if (isDesktopApp()) {
                event.preventDefault();

                setDesktopLoginLink(href);
                history.push(`/signup_user_complete/desktop${search}`);
            }
        };
    }, [history, search]);

    const gitlabStyle = useMemo(() => ({color: GitLabButtonColor, borderColor: GitLabButtonColor}), [GitLabButtonColor]);
    const gitlabUrl = enableSignUpWithGitLab ? `${Client4.getOAuthRoute()}/gitlab/signup${search}` : '';
    const gitlabOnClick = useCallback(() => desktopExternalAuth(gitlabUrl), [desktopExternalAuth, gitlabUrl]);

    const googleUrl = (isLicensed && enableSignUpWithGoogle) ? `${Client4.getOAuthRoute()}/google/signup${search}` : '';
    const googleOnClick = useCallback(() => desktopExternalAuth(googleUrl), [desktopExternalAuth, googleUrl]);

    const office365Url = (isLicensed && enableSignUpWithOffice365) ? `${Client4.getOAuthRoute()}/office365/signup${search}` : '';
    const office365OnClick = useCallback(() => desktopExternalAuth(office365Url), [desktopExternalAuth, office365Url]);

    const openIDStyle = useMemo(() => ({color: OpenIdButtonColor, borderColor: OpenIdButtonColor}), [OpenIdButtonColor]);
    const openIDUrl = (isLicensed && enableSignUpWithOpenId) ? `${Client4.getOAuthRoute()}/openid/signup${search}` : '';
    const openIDOnClick = useCallback(() => desktopExternalAuth(openIDUrl), [desktopExternalAuth, openIDUrl]);

    let samlUrl = '';
    if (isLicensed && enableSAML) {
        const newSearchParam = new URLSearchParams(search);
        newSearchParam.set('action', 'signup');

        samlUrl = `${Client4.getUrl()}/login/sso/saml?${newSearchParam.toString()}`;
    }
    const samlOnClick = useCallback(() => desktopExternalAuth(samlUrl), [desktopExternalAuth, samlUrl]);

    const handleHeaderBackButtonOnClick = useCallback(() => {
        if (!noAccounts) {
            trackEvent('signup_email', 'click_back');
        }

        history.goBack();
    }, [noAccounts, history]);

    const getAlternateLink = useCallback(() => (
        <AlternateLinkLayout
            className='signup-body-alternate-link'
            alternateMessage={formatMessage({
                id: 'signup_user_completed.haveAccount',
                defaultMessage: 'Already have an account?',
            })}
            alternateLinkPath='/login'
            alternateLinkLabel={formatMessage({
                id: 'signup_user_completed.signIn',
                defaultMessage: 'Log in',
            })}
        />
    ), [formatMessage]);

    useEffect(() => {
        const onWindowResize = throttle(() => {
            setIsMobileView(window.innerWidth < MOBILE_SCREEN_WIDTH);
        }, 100);

        const handleInvalidInvite = ({
            // eslint-disable-next-line @typescript-eslint/naming-convention
            server_error_id,
            message,
        }: {server_error_id: string; message: string}) => {
            let errorMessage;

            if (server_error_id === 'store.sql_user.save.max_accounts.app_error' ||
                server_error_id === 'api.team.add_user_to_team_from_invite.guest.app_error') {
                errorMessage = message;
            }

            setServerError(errorMessage || formatMessage({id: 'signup_user_completed.invalid_invite.title', defaultMessage: 'This invite link is invalid'}));
            setLoading(false);
        };

        const getInviteInfo = async (inviteId: string) => {
            const {data, error} = await dispatch(getTeamInviteInfo(inviteId));

            if (data) {
                setServerError('');
                setTeamName(data.name);
            } else if (error) {
                handleInvalidInvite(error);
            }

            setLoading(false);
        };

        const handleAddUserToTeamFromInvite = async (token: string, inviteId: string) => {
            const {data: team, error} = await dispatch(addUserToTeamFromInvite(token, inviteId));

            if (team) {
                history.push('/' + team.name + `/channels/${Constants.DEFAULT_CHANNEL}`);
            } else if (error) {
                handleInvalidInvite(error);
            }
        };

        dispatch(removeGlobalItem('team'));
        trackEvent('signup', 'signup_user_01_welcome', {...getRoleFromTrackFlow(), ...getMediumFromTrackFlow()});

        onWindowResize();

        window.addEventListener('resize', onWindowResize);

        if (search) {
            if ((inviteId || token) && loggedIn) {
                handleAddUserToTeamFromInvite(token, inviteId);
            } else if (inviteId) {
                getInviteInfo(inviteId);
            } else if (loggedIn) {
                if (onboardingFlowEnabled) {
                    // need info about whether admin or not,
                    // and whether admin has already completed
                    // first tiem onboarding. Instead of fetching and orchestrating that here,
                    // let the default root component handle it.
                    history.push('/');
                } else {
                    redirectUserToDefaultTeam();
                }
            }
        }

        return () => {
            window.removeEventListener('resize', onWindowResize);
        };
    }, []);

    useEffect(() => {
        if (SiteName) {
            document.title = SiteName;
        }
    }, [SiteName]);

    useEffect(() => {
        if (onCustomizeHeader) {
            onCustomizeHeader({
                onBackButtonClick: handleHeaderBackButtonOnClick,
                alternateLink: isMobileView ? getAlternateLink() : undefined,
            });
        }
    }, [onCustomizeHeader, handleHeaderBackButtonOnClick, isMobileView, getAlternateLink, search]);

    const handleBrandImageError = useCallback(() => {
        setBrandImageError(true);
    }, []);

    const dismissAlert = useCallback(() => {
        setAlertBanner(null);
    }, []);

    const handleEmailOnChange = useCallback(({target: {value: email}}: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(email);
        dismissAlert();

        if (emailError) {
            setEmailError('');
        }
    }, [dismissAlert, emailError]);

    const handleNameOnChange = useCallback(({target: {value: name}}: React.ChangeEvent<HTMLInputElement>) => {
        setName(name);
        dismissAlert();

        if (nameError) {
            setNameError('');
        }
    }, [dismissAlert, nameError]);

    const handlePasswordInputOnChange = useCallback(({target: {value: password}}: React.ChangeEvent<HTMLInputElement>) => {
        setPassword(password);
        dismissAlert();

        if (passwordError) {
            setPasswordError('');
        }
    }, [dismissAlert, passwordError]);

    const postSignupSuccess = useCallback(async () => {
        const redirectTo = (new URLSearchParams(search)).get('redirect_to');

        await dispatch(loadMe());

        if (token) {
            setGlobalItem(token, JSON.stringify({usedBefore: true}));
        }

        if (redirectTo) {
            history.push(redirectTo);
        } else if (onboardingFlowEnabled) {
            // need info about whether admin or not,
            // and whether admin has already completed
            // first tiem onboarding. Instead of fetching and orchestrating that here,
            // let the default root component handle it.
            history.push('/');
        } else {
            redirectUserToDefaultTeam();
        }
    }, [dispatch, history, onboardingFlowEnabled, search, token]);

    const handleSignupSuccess = useCallback(async (user: UserProfile, data: UserProfile) => {
        trackEvent('signup', 'signup_user_02_complete', getRoleFromTrackFlow());

        if (reminderInterval) {
            trackEvent('signup', `signup_from_reminder_${reminderInterval}`, {user: user.id});
        }

        const redirectTo = (new URLSearchParams(search)).get('redirect_to');

        const {error} = await dispatch(loginById(data.id, user.password));

        if (error) {
            if (error.server_error_id === 'api.user.login.not_verified.app_error') {
                let verifyUrl = '/should_verify_email?email=' + encodeURIComponent(user.email);

                if (teamName) {
                    verifyUrl += '&teamname=' + encodeURIComponent(teamName);
                }

                if (redirectTo) {
                    verifyUrl += '&redirect_to=' + redirectTo;
                }

                history.push(verifyUrl);
            } else {
                setServerError(error.message);
                setIsWaiting(false);
            }

            return;
        }

        await postSignupSuccess();
    }, [dispatch, history, postSignupSuccess, reminderInterval, search, teamName]);

    type TelemetryErrorList = {errors: Array<{field: string; rule: string}>; success: boolean};

    const isUserValid = useCallback(() => {
        let isValid = true;

        const providedEmail = emailInput.current?.value.trim();
        const telemetryEvents: TelemetryErrorList = {errors: [], success: true};

        if (!providedEmail) {
            setEmailError(formatMessage({id: 'signup_user_completed.required', defaultMessage: 'This field is required'}));
            telemetryEvents.errors.push({field: 'email', rule: 'not_provided'});
            isValid = false;
        } else if (!isEmail(providedEmail)) {
            setEmailError(formatMessage({id: 'signup_user_completed.validEmail', defaultMessage: 'Please enter a valid email address'}));
            telemetryEvents.errors.push({field: 'email', rule: 'invalid_email'});
            isValid = false;
        }

        const providedUsername = nameInput.current?.value.trim().toLowerCase();

        if (providedUsername) {
            const usernameError = isValidUsername(providedUsername);

            if (usernameError) {
                let nameError = '';
                if (usernameError.id === ValidationErrors.RESERVED_NAME) {
                    nameError = formatMessage({id: 'signup_user_completed.reserved', defaultMessage: 'This username is reserved, please choose a new one.'});
                } else {
                    nameError = formatMessage(
                        {
                            id: 'signup_user_completed.usernameLength',
                            defaultMessage: 'Usernames have to begin with a lowercase letter and be {min}-{max} characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.',
                        },
                        {
                            min: Constants.MIN_USERNAME_LENGTH,
                            max: Constants.MAX_USERNAME_LENGTH,
                        },
                    );
                }
                telemetryEvents.errors.push({field: 'username', rule: usernameError.id.toLowerCase()});
                setNameError(nameError);
                isValid = false;
            }
        } else {
            setNameError(formatMessage({id: 'signup_user_completed.required', defaultMessage: 'This field is required'}));
            telemetryEvents.errors.push({field: 'username', rule: 'not_provided'});
            isValid = false;
        }

        const providedPassword = passwordInput.current?.value ?? '';
        const {error, telemetryErrorIds} = isValidPassword(providedPassword, passwordConfig, intl);

        if (error) {
            setPasswordError(error as string);
            telemetryEvents.errors = [...telemetryEvents.errors, ...telemetryErrorIds];
            isValid = false;
        }

        if (telemetryEvents.errors.length) {
            telemetryEvents.success = false;
        }

        sendSignUpTelemetryEvents('validate_user', telemetryEvents);

        return isValid;
    }, [formatMessage, intl, passwordConfig]);

    const handleSubmit = useCallback(async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        sendSignUpTelemetryEvents('click_create_account', getRoleFromTrackFlow());
        setIsWaiting(true);

        if (isUserValid()) {
            setNameError('');
            setEmailError('');
            setPasswordError('');
            setServerError('');
            setIsWaiting(true);

            const user = {
                email: emailInput.current?.value.trim(),
                username: nameInput.current?.value.trim().toLowerCase(),
                password: passwordInput.current?.value,
            } as UserProfile;

            const redirectTo = (new URLSearchParams(search)).get('redirect_to') as string;

            const {data, error} = await dispatch(createUser(user, token, inviteId, redirectTo));

            if (error) {
                setAlertBanner({
                    mode: 'danger' as ModeType,
                    title: (error as ServerError).message,
                    onDismiss: dismissAlert,
                });
                setIsWaiting(false);
                return;
            }

            await handleSignupSuccess(user, data!);
            if (subscribeToSecurityNewsletter) {
                subscribeToSecurityNewsletterFunc();
            }
        } else {
            setIsWaiting(false);
        }
    }, [dismissAlert, dispatch, handleSignupSuccess, inviteId, isUserValid, search, subscribeToSecurityNewsletter, subscribeToSecurityNewsletterFunc, token]);

    const onEnterKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === Constants.KeyCodes.ENTER[0] && canSubmit) {
            handleSubmit(e);
        }
    }, [canSubmit, handleSubmit]);

    const handleReturnButtonOnClick = useCallback(() => history.replace('/'), [history]);

    const newsletterOnChange = useCallback(() => setSubscribeToSecurityNewsletter(!subscribeToSecurityNewsletter), [subscribeToSecurityNewsletter]);

    const getNewsletterCheck = () => {
        if (cwsAvailability === CSWAvailabilityCheckTypes.Available) {
            return (
                <CheckInput
                    id='signup-body-card-form-check-newsletter'
                    ariaLabel={formatMessage({id: 'newsletter_optin.checkmark.box', defaultMessage: 'newsletter checkbox'})}
                    name='newsletter'
                    onChange={newsletterOnChange}
                    text={
                        formatMessage(
                            {id: 'newsletter_optin.checkmark.text', defaultMessage: '<span>I would like to receive Mattermost security updates via newsletter.</span> By subscribing, I consent to receive emails from Mattermost with product updates, promotions, and company news. I have read the <a>Privacy Policy</a> and understand that I can <aa>unsubscribe</aa> at any time'},
                            {
                                a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                    <ExternalLink
                                        location='signup-newsletter-checkmark'
                                        href={HostedCustomerLinks.PRIVACY}
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                                aa: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                    <ExternalLink
                                        location='signup-newsletter-checkmark'
                                        href={HostedCustomerLinks.NEWSLETTER_UNSUBSCRIBE_LINK}
                                    >
                                        {chunks}
                                    </ExternalLink>
                                ),
                                span: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                    <span className='header'>{chunks}</span>
                                ),
                            },
                        )}
                    checked={subscribeToSecurityNewsletter}
                />
            );
        }
        return (
            <div className='newsletter'>
                <span className='interested'>
                    {formatMessage({id: 'newsletter_optin.title', defaultMessage: 'Interested in receiving Mattermost security, product, promotions, and company updates updates via newsletter?'})}
                </span>
                <span className='link'>
                    {formatMessage(
                        {id: 'newsletter_optin.desc', defaultMessage: 'Sign up at <a>{link}</a>.'},
                        {
                            link: HostedCustomerLinks.SECURITY_UPDATES,
                            a: (chunks: React.ReactNode | React.ReactNodeArray) => (
                                <ExternalLink
                                    location='signup'
                                    href={HostedCustomerLinks.SECURITY_UPDATES}
                                >
                                    {chunks}
                                </ExternalLink>
                            ),
                        },
                    )}
                </span>
            </div>
        );
    };

    const extraContent = useMemo(() => (
        <div className='signup-body-content-button-container'>
            <button
                className='signup-body-content-button-return'
                onClick={handleReturnButtonOnClick}
            >
                {formatMessage({id: 'signup_user_completed.return', defaultMessage: 'Return to log in'})}
            </button>
        </div>
    ), [formatMessage, handleReturnButtonOnClick]);

    const renderDesktopAuthToken = useCallback(() => (
        <DesktopAuthToken
            href={desktopLoginLink}
            onLogin={postSignupSuccess}
        />
    ), [desktopLoginLink, postSignupSuccess]);

    const privacyPolicyLinkRender = useCallback((chunks: string) => (
        <ExternalLink
            href={PrivacyPolicyLink as string}
            location='signup-privacy-policy'
        >
            {chunks}
        </ExternalLink>
    ), [PrivacyPolicyLink]);

    const termsOfUseLinkRenderer = useCallback((chunks: string) => (
        <ExternalLink
            href={TermsOfServiceLink as string}
            location='signup-terms-of-use'
        >
            {chunks}
        </ExternalLink>
    ), [TermsOfServiceLink]);

    const customMessage = useMemo(() => (
        nameError ? {type: ItemStatus.ERROR, value: nameError} as const : {
            type: ItemStatus.INFO,
            value: formatMessage({id: 'signup_user_completed.userHelp', defaultMessage: 'You can use lowercase letters, numbers, periods, dashes, and underscores.'}),
        } as const
    ), [formatMessage, nameError]);

    const emailCustomLabelForInput: CustomMessageInputType = useMemo(() => {
        // error will have preference over info message
        if (emailError) {
            return {type: ItemStatus.ERROR, value: emailError};
        }

        if (parsedEmail) {
            return {
                type: ItemStatus.INFO,
                value: formatMessage(
                    {
                        id: 'signup_user_completed.emailIs',
                        defaultMessage: "You'll use this address to sign in to {siteName}.",
                    },
                    {siteName: SiteName},
                ),
            };
        }

        return null;
    }, [SiteName, emailError, formatMessage, parsedEmail]);

    if (loading) {
        return (<LoadingScreen/>);
    }

    const getExternalSignupOptions = () => {
        const externalLoginOptions: ExternalLoginButtonType[] = [];

        if (!enableExternalSignup) {
            return externalLoginOptions;
        }

        if (enableSignUpWithGitLab) {
            externalLoginOptions.push({
                id: 'gitlab',
                url: gitlabUrl,
                icon: gitlabIcon,
                label: GitLabButtonText || formatMessage({id: 'login.gitlab', defaultMessage: 'GitLab'}),
                style: gitlabStyle,
                onClick: gitlabOnClick,
            });
        }

        if (isLicensed && enableSignUpWithGoogle) {
            externalLoginOptions.push({
                id: 'google',
                url: googleUrl,
                icon: googleIcon,
                label: formatMessage({id: 'login.google', defaultMessage: 'Google'}),
                onClick: googleOnClick,
            });
        }

        if (isLicensed && enableSignUpWithOffice365) {
            externalLoginOptions.push({
                id: 'office365',
                url: office365Url,
                icon: entraIcon,
                label: formatMessage({id: 'login.office365', defaultMessage: 'Entra ID'}),
                onClick: office365OnClick,
            });
        }

        if (isLicensed && enableSignUpWithOpenId) {
            externalLoginOptions.push({
                id: 'openid',
                url: openIDUrl,
                icon: openIDIcon,
                label: OpenIdButtonText || formatMessage({id: 'login.openid', defaultMessage: 'Open ID'}),
                style: openIDStyle,
                onClick: openIDOnClick,
            });
        }

        if (isLicensed && enableLDAP) {
            const newSearchParam = new URLSearchParams(search);
            newSearchParam.set('extra', Constants.CREATE_LDAP);

            externalLoginOptions.push({
                id: 'ldap',
                url: `${Client4.getUrl()}/login?${newSearchParam.toString()}`,
                icon: lockIcon,
                label: LdapLoginFieldName || formatMessage({id: 'signup.ldap', defaultMessage: 'AD/LDAP Credentials'}),
                onClick: noop,
            });
        }

        if (isLicensed && enableSAML) {
            externalLoginOptions.push({
                id: 'saml',
                url: samlUrl,
                icon: lockIcon,
                label: SamlLoginButtonText || formatMessage({id: 'login.saml', defaultMessage: 'SAML'}),
                onClick: samlOnClick,
            });
        }

        return externalLoginOptions;
    };

    const getCardTitle = () => {
        if (CustomDescriptionText) {
            return CustomDescriptionText;
        }

        if (!enableSignUpWithEmail && enableExternalSignup) {
            return formatMessage({id: 'signup_user_completed.cardtitle.external', defaultMessage: 'Create your account with one of the following:'});
        }

        return formatMessage({id: 'signup_user_completed.cardtitle', defaultMessage: 'Create your account'});
    };

    const getMessageSubtitle = () => {
        if (enableCustomBrand) {
            return CustomBrandText ? (
                <div className='signup-body-custom-branding-markdown'>
                    <Markdown
                        message={CustomBrandText}
                        options={markdownOptions}
                    />
                </div>
            ) : null;
        }

        return (
            <p className='signup-body-message-subtitle'>
                {formatMessage({
                    id: 'signup_user_completed.subtitle',
                    defaultMessage: 'Create your Mattermost account to start collaborating with your team',
                })}
            </p>
        );
    };

    const getContent = () => {
        if (!enableSignUpWithEmail && !enableExternalSignup) {
            return (
                <ColumnLayout
                    title={formatMessage({id: 'login.noMethods.title', defaultMessage: 'This server doesn’t have any sign-in methods enabled'})}
                    message={formatMessage({id: 'login.noMethods.subtitle', defaultMessage: 'Please contact your System Administrator to resolve this.'})}
                />
            );
        }

        if (!isWaiting && (noOpenServer || serverError || usedBefore)) {
            const titleColumn = noOpenServer ? (
                formatMessage({id: 'signup_user_completed.no_open_server.title', defaultMessage: 'This server doesn’t allow open signups'})
            ) : (
                serverError ||
                formatMessage({id: 'signup_user_completed.invalid_invite.title', defaultMessage: 'This invite link is invalid'})
            );

            return (
                <ColumnLayout
                    title={titleColumn}
                    message={formatMessage({id: 'signup_user_completed.invalid_invite.message', defaultMessage: 'Please speak with your Administrator to receive an invitation.'})}
                    SVGElement={laptopAlertIcon}
                    extraContent={extraContent}
                />
            );
        }

        if (desktopLoginLink) {
            return (
                <Route
                    path={'/signup_user_complete/desktop'}
                    render={renderDesktopAuthToken}
                />
            );
        }

        return (
            <>
                <div
                    className={classNames(
                        'signup-body-message',
                        {
                            'custom-branding': enableCustomBrand,
                            'with-brand-image': enableCustomBrand && !brandImageError,
                            'with-alternate-link': !isMobileView,
                        },
                    )}
                >
                    {enableCustomBrand && !brandImageError ? (
                        <img
                            className={classNames('signup-body-custom-branding-image')}
                            alt='brand image'
                            src={Client4.getBrandImageUrl('0')}
                            onError={handleBrandImageError}
                        />
                    ) : (
                        <h1 className='signup-body-message-title'>
                            {formatMessage({id: 'signup_user_completed.title', defaultMessage: 'Let’s get started'})}
                        </h1>
                    )}
                    {getMessageSubtitle()}
                    {!enableCustomBrand && (
                        <div className='signup-body-message-svg'>
                            <ManWithLaptopSVG/>
                        </div>
                    )}
                </div>
                <div className='signup-body-action'>
                    {!isMobileView && getAlternateLink()}
                    <div className={classNames('signup-body-card', {'custom-branding': enableCustomBrand, 'with-error': hasError})}>
                        <div
                            className='signup-body-card-content'
                            onKeyDown={onEnterKeyDown}
                            tabIndex={0}
                        >
                            <p className='signup-body-card-title'>
                                {getCardTitle()}
                            </p>
                            {enableCustomBrand && getMessageSubtitle()}
                            {alertBanner && (
                                <AlertBanner
                                    className='login-body-card-banner'
                                    mode={alertBanner.mode}
                                    title={alertBanner.title}
                                    onDismiss={alertBanner.onDismiss}
                                />
                            )}
                            {enableSignUpWithEmail && (
                                <div className='signup-body-card-form'>
                                    <Input
                                        ref={emailInput}
                                        name='email'
                                        className='signup-body-card-form-email-input'
                                        type='text'
                                        inputSize={SIZE.LARGE}
                                        value={email}
                                        onChange={handleEmailOnChange}
                                        placeholder={formatMessage({
                                            id: 'signup_user_completed.emailLabel',
                                            defaultMessage: 'Email address',
                                        })}
                                        disabled={isWaiting || Boolean(parsedEmail)}
                                        autoFocus={true}
                                        customMessage={emailCustomLabelForInput}
                                        onBlur={onBlurEmailInput}
                                    />
                                    <Input
                                        ref={nameInput}
                                        name='name'
                                        className='signup-body-card-form-name-input'
                                        type='text'
                                        inputSize={SIZE.LARGE}
                                        value={name}
                                        onChange={handleNameOnChange}
                                        placeholder={formatMessage({
                                            id: 'signup_user_completed.chooseUser',
                                            defaultMessage: 'Choose a Username',
                                        })}
                                        disabled={isWaiting}
                                        autoFocus={Boolean(parsedEmail)}
                                        customMessage={customMessage}
                                        onBlur={onBlurNameInput}
                                    />
                                    <PasswordInput
                                        ref={passwordInput}
                                        className='signup-body-card-form-password-input'
                                        value={password}
                                        inputSize={SIZE.LARGE}
                                        onChange={handlePasswordInputOnChange}
                                        disabled={isWaiting}
                                        createMode={true}
                                        info={passwordInfo as string}
                                        error={passwordError}
                                        onBlur={onBlurPassword}
                                    />
                                    {getNewsletterCheck()}
                                    <SaveButton
                                        extraClasses='signup-body-card-form-button-submit large'
                                        saving={isWaiting}
                                        disabled={!canSubmit}
                                        onClick={handleSubmit}
                                        defaultMessage={formatMessage({id: 'signup_user_completed.create', defaultMessage: 'Create account'})}
                                        savingMessage={formatMessage({id: 'signup_user_completed.saving', defaultMessage: 'Creating account…'})}
                                    />
                                </div>
                            )}
                            {enableSignUpWithEmail && enableExternalSignup && (
                                <div className='signup-body-card-form-divider'>
                                    <span className='signup-body-card-form-divider-label'>
                                        {formatMessage({id: 'signup_user_completed.or', defaultMessage: 'or create an account with'})}
                                    </span>
                                </div>
                            )}
                            {enableExternalSignup && (
                                <div className={classNames('signup-body-card-form-login-options', {column: !enableSignUpWithEmail})}>
                                    {getExternalSignupOptions().map((option) => (
                                        <ExternalLoginButton
                                            key={option.id}
                                            direction={enableSignUpWithEmail ? undefined : 'column'}
                                            {...option}
                                        />
                                    ))}
                                </div>
                            )}
                            {enableSignUpWithEmail && !serverError && (
                                <p className='signup-body-card-agreement'>
                                    <FormattedMessage
                                        id='signup.agreement'
                                        defaultMessage='By proceeding to create your account and use {siteName}, you agree to our <termsOfUseLink>Terms of Use</termsOfUseLink> and <privacyPolicyLink>Privacy Policy</privacyPolicyLink>.  If you do not agree, you cannot use {siteName}.'
                                        values={{
                                            siteName: SiteName,
                                            termsOfUseLink: termsOfUseLinkRenderer,
                                            privacyPolicyLink: privacyPolicyLinkRender,
                                        }}
                                    />
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className='signup-body'>
            <div className='signup-body-content'>
                {getContent()}
            </div>
        </div>
    );
};

export default Signup;
