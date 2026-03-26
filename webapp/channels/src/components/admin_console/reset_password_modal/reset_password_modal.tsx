// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Input from 'components/widgets/inputs/input/input';

import {isValidPassword} from 'utils/password';
import {getFullName} from 'utils/utils';

import '../admin_modal_with_input.scss';

interface PasswordConfig {
    minimumLength: number;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
    requireUppercase: boolean;
}

export type Props = {
    user?: UserProfile;
    currentUserId: string;
    onSuccess?: () => void;
    onExited: () => void;
    passwordConfig: PasswordConfig;
    canSendPasswordResetEmail: boolean;
    actions: {
        updateUserPassword: (userId: string, currentPassword: string, password: string) => Promise<ActionResult>;
        sendPasswordResetEmail: (email: string) => Promise<ActionResult>;
    };
}

export default function ResetPasswordModal({
    user,
    currentUserId,
    onSuccess,
    onExited,
    passwordConfig,
    canSendPasswordResetEmail,
    actions,
}: Props) {
    const {formatMessage} = useIntl();

    const [show, setShow] = useState(true);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [errorNewPass, setErrorNewPass] = useState<React.ReactNode>(null);
    const [errorCurrentPass, setErrorCurrentPass] = useState<React.ReactNode>(null);

    const isResettingOwnPassword = user?.id === currentUserId;
    const isAuthUser = Boolean(user?.auth_service);

    const canUseEmailReset = !isResettingOwnPassword && !isAuthUser && canSendPasswordResetEmail;
    const [showManualReset, setShowManualReset] = useState(!canUseEmailReset);
    const isEmailReset = canUseEmailReset && !showManualReset;

    const currentPasswordRef = useRef<HTMLInputElement>(null);
    const newPasswordRef = useRef<HTMLInputElement>(null);

    const emailResetDescription = useMemo(() => formatMessage({
        id: 'admin.reset_password.emailDescription',
        defaultMessage: 'Send a password reset link to {email}. The user will choose a new password securely.',
    }, {email: user?.email ?? ''}), [formatMessage, user?.email]);

    const handleCancel = useCallback(() => {
        setShow(false);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!user) {
            return;
        }

        // Clear previous errors
        setErrorNewPass(null);
        setErrorCurrentPass(null);

        if (isEmailReset) {
            const result = await actions.sendPasswordResetEmail(user.email);
            if ('error' in result) {
                setErrorCurrentPass(result.error.message);
                return;
            }
            onSuccess?.();
            setShow(false);
            return;
        }

        // Validate current password if resetting own password
        if (isResettingOwnPassword && currentPassword === '') {
            setErrorCurrentPass(formatMessage({
                id: 'admin.reset_password.missing_current',
                defaultMessage: 'Please enter your current password.',
            }));
            return;
        }

        // Validate new password
        const {valid, error} = isValidPassword(newPassword, passwordConfig);
        if (!valid && error) {
            setErrorNewPass(error);
            return;
        }

        const result = await actions.updateUserPassword(
            user.id,
            isResettingOwnPassword ? currentPassword : '',
            newPassword,
        );

        if ('error' in result) {
            setErrorCurrentPass(result.error.message);
            return;
        }

        onSuccess?.();
        setShow(false);
    }, [user, isEmailReset, isResettingOwnPassword, currentPassword, newPassword, passwordConfig, actions, onSuccess, formatMessage]);

    if (!user) {
        return null;
    }

    const displayName = getFullName(user) || user.username;

    const title = isAuthUser ?
        formatMessage({
            id: 'admin.reset_password.titleSwitchFor',
            defaultMessage: 'Switch account to Email/Password for {name}',
        }, {name: displayName}) :
        formatMessage({
            id: 'admin.reset_password.titleResetFor',
            defaultMessage: 'Reset password for {name}',
        }, {name: displayName});

    const confirmButtonText = isEmailReset ?
        formatMessage({
            id: 'admin.reset_password.sendEmail',
            defaultMessage: 'Send email',
        }) :
        formatMessage({
            id: 'admin.reset_password.reset',
            defaultMessage: 'Reset',
        });

    return (
        <GenericModal
            id='resetPasswordModal'
            className='ResetPasswordModal'
            modalHeaderText={title}
            show={show}
            onExited={onExited}
            onHide={handleCancel}
            handleCancel={handleCancel}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            confirmButtonText={confirmButtonText}
            compassDesign={true}
            autoCloseOnConfirmButton={false}
            errorText={errorCurrentPass ? <span className='error'>{errorCurrentPass}</span> : undefined}
        >
            <div className='ResetPasswordModal__body'>
                {isEmailReset ? (
                    <div className='ResetPasswordModal__email-panel'>
                        <p className='ResetPasswordModal__email-description'>
                            {emailResetDescription}
                        </p>
                        <button
                            type='button'
                            className='style--none color--link ResetPasswordModal__manual-trigger'
                            onClick={() => setShowManualReset(true)}
                        >
                            {formatMessage({
                                id: 'admin.reset_password.setManually',
                                defaultMessage: 'Set a new password manually',
                            })}
                        </button>
                    </div>
                ) : (
                    <>
                        {canUseEmailReset && (
                            <p className='ResetPasswordModal__email-description'>
                                {formatMessage({
                                    id: 'admin.reset_password.manualDescription',
                                    defaultMessage: 'Prefer not to choose a password for this user yourself? Send them a reset email instead.',
                                })}
                            </p>
                        )}
                        {canUseEmailReset && (
                            <button
                                type='button'
                                className='style--none color--link ResetPasswordModal__manual-trigger'
                                onClick={() => setShowManualReset(false)}
                            >
                                {formatMessage({
                                    id: 'admin.reset_password.sendResetEmail',
                                    defaultMessage: 'Send password reset email instead',
                                })}
                            </button>
                        )}
                        {isResettingOwnPassword && (
                            <Input
                                ref={currentPasswordRef as React.Ref<HTMLInputElement>}
                                type='password'
                                name='currentPassword'
                                autoComplete='current-password'
                                label={formatMessage({
                                    id: 'admin.reset_password.currentPassword',
                                    defaultMessage: 'Current password',
                                })}
                                placeholder={formatMessage({
                                    id: 'admin.reset_password.enterCurrentPassword',
                                    defaultMessage: 'Enter current password',
                                })}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                autoFocus={true}
                            />
                        )}
                        <Input
                            ref={newPasswordRef as React.Ref<HTMLInputElement>}
                            type='password'
                            name='newPassword'
                            autoComplete='new-password'
                            label={formatMessage({
                                id: 'admin.reset_password.newPassword',
                                defaultMessage: 'New password',
                            })}
                            placeholder={formatMessage({
                                id: 'admin.reset_password.enterNewPassword',
                                defaultMessage: 'Enter new password',
                            })}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            autoFocus={!isResettingOwnPassword}
                            customMessage={errorNewPass ? {type: 'error', value: errorNewPass} : undefined}
                        />
                    </>
                )}
            </div>
        </GenericModal>
    );
}
