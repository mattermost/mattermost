// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ReactNode, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import SaveButton from 'components/button/save_button';
import type {SubmitOptions} from 'components/claim/components/email_to_ldap';
import ShieldWithCheckmarkSVG from 'components/common/svg_images_components/shield_with_checkmark';
import ColumnLayout from 'components/header_footer_route/content_layouts/column';
import Input, {SIZE} from 'components/widgets/inputs/input/input';

import './login_mfa.scss';

const messages = defineMessages({
    submit: {id: 'login_mfa.submit', defaultMessage: 'Submit'},
    loggingIn: {id: 'login_mfa.saving', defaultMessage: 'Logging in…'},
});

type LoginMfaProps = {
    loginId: string | null;
    password: string;
    title?: ReactNode;
    subtitle?: ReactNode;
    onSubmit: ({loginId, password, token}: SubmitOptions) => void;
}

const LoginMfa = ({loginId, password, title, subtitle, onSubmit}: LoginMfaProps) => {
    const {formatMessage} = useIntl();

    const [token, setToken] = useState('');
    const [saving, setSaving] = useState(false);

    const handleInputOnChange = ({target: {value: token}}: React.ChangeEvent<HTMLInputElement>) => {
        setToken(token.trim().replace(/\s/g, ''));
    };

    const handleSaveButtonOnClick = (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();

        if (!saving) {
            setSaving(true);

            onSubmit({loginId: loginId || '', password, token});
        }
    };

    const onEnterKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (token) {
            handleSaveButtonOnClick(e);
        }
    };

    return (
        <ColumnLayout
            title={title || formatMessage({id: 'login_mfa.title', defaultMessage: 'Enter MFA Token'})}
            message={subtitle || formatMessage({id: 'login_mfa.subtitle', defaultMessage: 'To complete the sign in process, please enter a token from your smartphone\'s authenticator'})}
            SVGElement={<ShieldWithCheckmarkSVG/>}
            extraContent={(
                <div className='login-mfa-form'>
                    <Input
                        name='token'
                        containerClassName='login-mfa-form-input'
                        type='text'
                        inputSize={SIZE.LARGE}
                        value={token}
                        onChange={handleInputOnChange}
                        placeholder={formatMessage({id: 'login_mfa.token', defaultMessage: 'Enter MFA Token'})}
                        autoFocus={true}
                        disabled={saving}
                    />
                    <div className='login-mfa-form-button-container'>
                        <SaveButton
                            size={'large'}
                            saving={saving}
                            disabled={!token}
                            onClick={handleSaveButtonOnClick}
                            defaultMessage={messages.submit}
                            savingMessage={messages.loggingIn}
                        />
                    </div>
                </div>
            )}
            onEnterKeyDown={onEnterKeyDown}
        />
    );
};

export default LoginMfa;
