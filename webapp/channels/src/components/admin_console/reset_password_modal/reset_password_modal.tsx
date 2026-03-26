// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useRef, useState} from 'react';
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

    const offerEmailReset = !isResettingOwnPassword && !isAuthUser && canSendPasswordResetEmail;

    const [useManualEntry, setUseManualEntry] = useState(false);

    const currentPasswordRef = useRef<HTMLInputElement>(null);
    const newPasswordRef = useRef<HTMLInputElement>(null);

    const isEmailFlow = offerEmailReset && !useManualEntry;

    const handleCancel = useCallback(() => {
        setShow(false);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!user) {
            return;
        }

        setErrorNewPass(null);
        setErrorCurrentPass(null);

        if (isEmailFlow) {
            const result = await actions.sendPasswordResetEmail(user.email);
            if ('error' in result) {
                setErrorCurrentPass(result.error.message);
                return;
            }
            onSuccess?.();
            setShow(false);
            return;
        }

        if (isResettingOwnPassword && currentPassword === '') {
            setErrorCurrentPass(formatMessage({
                id: 'admin.reset_password.missing_current',
                defaultMessage: 'Please enter your current password.',
            }));
            return;
        }

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
    }, [user, isEmailFlow, isResettingOwnPassword, currentPassword, newPassword, passwordConfig, actions, onSuccess, formatMessage]);

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

    const confirmButtonText = isEmailFlow ?
        formatMessage({
            id: 'admin.reset_password.sendResetLink',
            defaultMessage: 'Send reset link',
        }) :
        formatMessage({
            id: 'admin.reset_password.reset',
            defaultMessage: 'Reset',
        });

    const methodPrompt = formatMessage({
        id: 'admin.reset_password.methodPrompt',
        defaultMessage: 'How should this user set a new password?',
    });

    const emailTabLabel = formatMessage({
        id: 'admin.reset_password.emailTab',
        defaultMessage: 'Email link',
    });

    const manualTabLabel = formatMessage({
        id: 'admin.reset_password.manualTab',
        defaultMessage: 'Enter new password',
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
                {offerEmailReset && (
                    <>
                        <p
                            id='resetPasswordModal-method-prompt'
                            className='ResetPasswordModal__method-prompt'
                        >
                            {methodPrompt}
                        </p>
                        <div
                            className='ResetPasswordModal__method-tabs'
                            role='tablist'
                            aria-labelledby='resetPasswordModal-method-prompt'
                        >
                            <button
                                type='button'
                                role='tab'
                                id='resetPasswordModal-tab-email'
                                aria-selected={!useManualEntry}
                                className={classNames('ResetPasswordModal__method-tab', {
                                    'ResetPasswordModal__method-tab--active': !useManualEntry,
                                })}
                                onClick={() => setUseManualEntry(false)}
                            >
                                {emailTabLabel}
                            </button>
                            <button
                                type='button'
                                role='tab'
                                id='resetPasswordModal-tab-manual'
                                aria-selected={useManualEntry}
                                className={classNames('ResetPasswordModal__method-tab', {
                                    'ResetPasswordModal__method-tab--active': useManualEntry,
                                })}
                                onClick={() => setUseManualEntry(true)}
                            >
                                {manualTabLabel}
                            </button>
                        </div>
                    </>
                )}
                {isEmailFlow ? (
                    <p
                        className='ResetPasswordModal__email-instruction'
                        role='tabpanel'
                        aria-labelledby='resetPasswordModal-tab-email'
                    >
                        {formatMessage({
                            id: 'admin.reset_password.emailInstruction',
                            defaultMessage: 'We will email {email} a secure link. The user chooses their own password on that page.',
                        }, {email: user.email})}
                    </p>
                ) : (
                    <>
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
