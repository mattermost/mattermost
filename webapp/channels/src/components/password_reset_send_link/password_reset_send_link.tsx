// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import throttle from 'lodash/throttle';
import React, {useState, useCallback, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {useLocation, useHistory} from 'react-router-dom';

import {sendPasswordResetEmail} from 'mattermost-redux/actions/users';
import {isEmail} from 'mattermost-redux/utils/helpers';

import ManWithMailBox from 'components/common/svg_images_components/man_with_mailbox_svg';
import WomanWithLock from 'components/common/svg_images_components/woman_with_lock_svg';
import BrandedButton from 'components/custom_branding/branded_button';
import BrandedInput from 'components/custom_branding/branded_input';
import AlternateLinkLayout from 'components/header_footer_route/content_layouts/alternate_link';
import type {CustomizeHeaderType} from 'components/header_footer_route/header_footer_route';
import Input, {SIZE} from 'components/widgets/inputs/input/input';

const MOBILE_SCREEN_WIDTH = 1200;

type Props = {
    onCustomizeHeader?: CustomizeHeaderType;
}

const PasswordResetSendLink = ({onCustomizeHeader}: Props) => {
    const [errorText, setErrorText] = useState<React.ReactNode>(null);
    const [linkSent, setLinkSent] = useState<boolean>(false);
    const [email, setEmail] = useState<string>('');
    const dispatch = useDispatch();
    const intl = useIntl();
    const history = useHistory();
    const [isMobileView, setIsMobileView] = useState(false);
    const {search} = useLocation();

    const handleSendLink = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        const emailClean = email.trim().toLowerCase();
        if (!email || !isEmail(emailClean)) {
            setErrorText((
                <FormattedMessage
                    id='password_send.error'
                    defaultMessage='Please enter a valid email address.'
                />
            ));
            return;
        }

        // End of error checking clear error
        setErrorText(null);

        const {data, error} = await dispatch(sendPasswordResetEmail(emailClean));
        if (data) {
            setErrorText(null);
            setLinkSent(true);
        } else if (error) {
            setErrorText(error.message);
            setLinkSent(false);
        }
    }, [email, sendPasswordResetEmail]);

    const handleHeaderBackButtonOnClick = useCallback(() => {
        history.goBack();
    }, [history]);

    const getAlternateLink = useCallback(() => (
        <AlternateLinkLayout
            className='signup-body-alternate-link'
            alternateMessage={intl.formatMessage({
                id: 'signup_user_completed.haveAccount',
                defaultMessage: 'Already have an account?',
            })}
            alternateLinkPath='/login'
            alternateLinkLabel={intl.formatMessage({
                id: 'signup_user_completed.signIn',
                defaultMessage: 'Log in',
            })}
        />
    ), []);

    useEffect(() => {
        if (onCustomizeHeader) {
            onCustomizeHeader({
                onBackButtonClick: handleHeaderBackButtonOnClick,
                alternateLink: isMobileView ? getAlternateLink() : undefined,
            });
        }
    }, [onCustomizeHeader, handleHeaderBackButtonOnClick, isMobileView, getAlternateLink, search]);

    const onWindowResize = throttle(() => {
        setIsMobileView(window.innerWidth < MOBILE_SCREEN_WIDTH);
    }, 100);

    useEffect(() => {
        onWindowResize();
        window.addEventListener('resize', onWindowResize);
        return () => {
            window.removeEventListener('resize', onWindowResize);
        };
    }, []);

    let errorNode = null;
    if (errorText) {
        errorNode = (
            <div className='form-group has-error'>
                <label className='control-label'>{errorText}</label>
            </div>
        );
    }

    let formClass = 'form-group';
    if (errorNode) {
        formClass += ' has-error';
    }
    if (linkSent) {
        return (
            <div>
                <div className='col-sm-12'>
                    <div className='signup-team__container reset-password'>
                        <ManWithMailBox/>
                        <FormattedMessage
                            id='password_send.title_link_send'
                            tagName='h1'
                            defaultMessage='Reset Link Sent'
                        />
                        <div id='passwordResetEmailSent'>
                            <FormattedMessage
                                id='password_send.link'
                                defaultMessage='If the account exists, a password reset email will be sent to:'
                            />
                            <br/>
                            <p>
                                <b>{email}</b>
                            </p>
                        </div>
                        <BrandedButton>
                            <button
                                id='passwordResetReturnToLoginButton'
                                data-testid='returnToLogin'
                                type='submit'
                                className='btn btn-primary'
                                onClick={handleHeaderBackButtonOnClick}
                            >
                                <FormattedMessage
                                    id='password_send.return_to_login'
                                    defaultMessage='Return to Log In'
                                />
                            </button>
                        </BrandedButton>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className='col-sm-12'>
                <div className='signup-team__container reset-password'>
                    <WomanWithLock/>

                    <FormattedMessage
                        id='password_send.title'
                        tagName='h1'
                        defaultMessage='Reset Your Password'
                    />

                    <form onSubmit={handleSendLink}>
                        <p>
                            <FormattedMessage
                                id='password_send.description'
                                defaultMessage='To reset your password, enter the email address you used to sign up'
                            />
                        </p>
                        <div className='input-line'>
                            <div className={formClass}>
                                <BrandedInput>
                                    <Input
                                        id='passwordResetEmailInput'
                                        data-testid='email'
                                        type='email'
                                        className='form-control'
                                        name='email'
                                        placeholder={intl.formatMessage({
                                            id: 'password_send.email',
                                            defaultMessage: 'Enter email address',
                                        })}
                                        inputSize={SIZE.LARGE}
                                        spellCheck='false'
                                        autoFocus={true}
                                        onChange={(e) => setEmail(e.target.value)}
                                        value={email}
                                    />
                                </BrandedInput>
                            </div>
                            <BrandedButton>
                                <button
                                    id='passwordResetButton'
                                    type='submit'
                                    data-testid='reset-button'
                                    className='btn btn-primary'
                                >
                                    <FormattedMessage
                                        id='password_send.reset'
                                        defaultMessage='Reset'
                                    />
                                </button>
                            </BrandedButton>
                        </div>
                        {errorNode}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default PasswordResetSendLink;
