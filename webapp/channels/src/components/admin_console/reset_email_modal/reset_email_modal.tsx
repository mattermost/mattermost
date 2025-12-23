// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {isEmail} from 'mattermost-redux/utils/helpers';

import Input from 'components/widgets/inputs/input/input';

import {getFullName} from 'utils/utils';

import '../admin_modal_with_input.scss';

type Props = {
    user?: UserProfile;
    currentUserId: string;
    onSuccess: (email: string) => void;
    onExited: () => void;
    actions: {
        patchUser: (user: UserProfile) => Promise<ActionResult>;
    };
}

export default function ResetEmailModal({
    user,
    currentUserId,
    onSuccess,
    onExited,
    actions,
}: Props) {
    const {formatMessage} = useIntl();

    const [show, setShow] = useState(true);
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [error, setError] = useState<React.ReactNode>(null);
    const [emailError, setEmailError] = useState<React.ReactNode>(null);
    const [passwordError, setPasswordError] = useState<React.ReactNode>(null);

    const emailRef = useRef<HTMLInputElement>(null);
    const currentPasswordRef = useRef<HTMLInputElement>(null);

    const isUpdatingOwnEmail = user?.id === currentUserId;

    const handleCancel = useCallback(() => {
        setShow(false);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!user) {
            return;
        }

        // Clear previous errors
        setError(null);
        setEmailError(null);
        setPasswordError(null);

        // Validate email
        if (!email || !isEmail(email)) {
            setEmailError(formatMessage({
                id: 'user.settings.general.validEmail',
                defaultMessage: 'Please enter a valid email address.',
            }));
            return;
        }

        // Validate current password if updating own email
        if (isUpdatingOwnEmail && !currentPassword) {
            setPasswordError(formatMessage({
                id: 'admin.reset_email.missing_current_password',
                defaultMessage: 'Please enter your current password.',
            }));
            return;
        }

        const updatedUser: UserProfile = {
            ...user,
            email: email.trim().toLowerCase(),
        };

        if (isUpdatingOwnEmail) {
            updatedUser.password = currentPassword;
        }

        const result = await actions.patchUser(updatedUser);

        if ('error' in result) {
            const isEmailError = result.error.server_error_id === 'app.user.save.email_exists.app_error';
            const isPasswordError = result.error.server_error_id === 'api.user.check_user_password.invalid.app_error';

            if (isEmailError) {
                setEmailError(result.error.message);
            } else if (isPasswordError) {
                setPasswordError(result.error.message);
            } else {
                setError(result.error.message);
            }
            return;
        }

        onSuccess(updatedUser.email);
        setShow(false);
    }, [user, email, currentPassword, isUpdatingOwnEmail, actions, onSuccess, formatMessage]);

    if (!user) {
        return null;
    }

    const displayName = getFullName(user) || user.username;

    const title = formatMessage({
        id: 'admin.reset_email.titleResetFor',
        defaultMessage: 'Update email for {name}',
    }, {name: displayName});

    return (
        <GenericModal
            id='resetEmailModal'
            className='ResetEmailModal'
            modalHeaderText={title}
            show={show}
            onExited={onExited}
            onHide={handleCancel}
            handleCancel={handleCancel}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            confirmButtonText={formatMessage({
                id: 'admin.reset_email.update',
                defaultMessage: 'Update',
            })}
            compassDesign={true}
            autoCloseOnConfirmButton={false}
            errorText={error ? <span className='error'>{error}</span> : undefined}
            dataTestId='resetEmailModal'
        >
            <div className='ResetEmailModal__body'>
                <Input
                    ref={emailRef as React.Ref<HTMLInputElement>}
                    type='email'
                    name='newEmail'
                    autoComplete='off'
                    label={formatMessage({
                        id: 'admin.reset_email.newEmail',
                        defaultMessage: 'New email',
                    })}
                    placeholder={formatMessage({
                        id: 'admin.reset_email.enterNewEmail',
                        defaultMessage: 'Enter new email address',
                    })}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus={true}
                    maxLength={128}
                    customMessage={emailError ? {type: 'error', value: emailError} : undefined}
                />
                {isUpdatingOwnEmail && (
                    <Input
                        ref={currentPasswordRef as React.Ref<HTMLInputElement>}
                        type='password'
                        name='currentPassword'
                        autoComplete='current-password'
                        label={formatMessage({
                            id: 'admin.reset_email.currentPassword',
                            defaultMessage: 'Current password',
                        })}
                        placeholder={formatMessage({
                            id: 'admin.reset_email.enterCurrentPassword',
                            defaultMessage: 'Enter current password',
                        })}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        customMessage={passwordError ? {type: 'error', value: passwordError} : undefined}
                    />
                )}
            </div>
        </GenericModal>
    );
}
