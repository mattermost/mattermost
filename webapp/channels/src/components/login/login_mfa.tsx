// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {SubmitOptions} from 'components/claim/components/email_to_ldap';
import ShieldWithCheckmarkSVG from 'components/common/svg_images_components/shield_with_checkmark';
import ColumnLayout from 'components/header_footer_route/content_layouts/column';
import SaveButton from 'components/save_button';
import Input, {SIZE} from 'components/widgets/inputs/input/input';

import './login_mfa.scss';

type LoginMfaProps = {
    loginId: string | null;
    password: string;
    title?: MessageDescriptor;
    subtitle?: MessageDescriptor;
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
            title={formatMessage(title || {id: 'login_mfa.title', defaultMessage: 'Enter MFA Token'})}
            message={formatMessage(subtitle || {id: 'login_mfa.subtitle', defaultMessage: 'To complete the sign in process, please enter a token from your smartphone\'s authenticator'})}
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
                            extraClasses='login-mfa-form-button-submit large'
                            saving={saving}
                            disabled={!token}
                            onClick={handleSaveButtonOnClick}
                            defaultMessage={formatMessage({id: 'login_mfa.submit', defaultMessage: 'Submit'})}
                            savingMessage={formatMessage({id: 'login_mfa.saving', defaultMessage: 'Logging in…'})}
                        />
                    </div>
                </div>
            )}
            onEnterKeyDown={onEnterKeyDown}
        />
    );
};

export default LoginMfa;
