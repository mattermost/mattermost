// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useIntl} from 'react-intl';

import {
    CheckIcon,
    ContentCopyIcon,
    InformationOutlineIcon,
    RefreshIcon,
} from '@mattermost/compass-icons/components';
import {GenericModal} from '@mattermost/components';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import useCopyText from 'components/common/hooks/useCopyText';
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

type ResetMethod = 'email' | 'manual';

const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const NUMBERS = '23456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';
const PASSWORD_SEGMENTS = 4;

function getRandomIndex(length: number) {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % length;
}

function pickRandomCharacter(characters: string) {
    return characters[getRandomIndex(characters.length)];
}

function shuffleString(value: string) {
    const chars = value.split('');

    for (let i = chars.length - 1; i > 0; i--) {
        const j = getRandomIndex(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join('');
}

function generatePassword(passwordConfig: PasswordConfig) {
    const targetLength = Math.max(passwordConfig.minimumLength || 10, 16);
    const characterSets = [LOWERCASE, UPPERCASE, NUMBERS, SYMBOLS];
    const passwordCharacters = characterSets.map((characters) => pickRandomCharacter(characters));
    const allCharacters = characterSets.join('');

    while (passwordCharacters.length < targetLength) {
        passwordCharacters.push(pickRandomCharacter(allCharacters));
    }

    return shuffleString(passwordCharacters.join(''));
}

function getPasswordStrength(password: string, passwordConfig: PasswordConfig) {
    if (!password) {
        return 0;
    }

    const minimumLength = passwordConfig.minimumLength || 10;
    const characterVariety = [
        (/[a-z]/).test(password),
        (/[A-Z]/).test(password),
        (/[0-9]/).test(password),
        (/[ !"\\#$%&'()*+,-./:;<=>?@[\]^_`|~]/).test(password),
    ].filter(Boolean).length;

    let strength = 0;

    if (password.length >= minimumLength) {
        strength++;
    }

    if (password.length >= Math.max(minimumLength + 2, 12)) {
        strength++;
    }

    if (characterVariety >= 3) {
        strength++;
    }

    if (characterVariety === 4 && password.length >= Math.max(minimumLength + 6, 16)) {
        strength++;
    }

    return Math.min(strength, PASSWORD_SEGMENTS);
}

export type Props = {
    user?: UserProfile;
    currentUserId: string;
    onSuccess?: () => void;
    onExited: () => void;
    passwordConfig: PasswordConfig;
    actions: {
        sendPasswordResetEmail: (email: string) => Promise<ActionResult>;
        updateUserPassword: (userId: string, currentPassword: string, password: string) => Promise<ActionResult>;
    };
}

export default function ResetPasswordModal({
    user,
    currentUserId,
    onSuccess,
    onExited,
    passwordConfig,
    actions,
}: Props) {
    const {formatMessage} = useIntl();

    const [show, setShow] = useState(true);
    const [resetMethod, setResetMethod] = useState<ResetMethod>('email');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [errorNewPass, setErrorNewPass] = useState<React.ReactNode>(null);
    const [modalError, setModalError] = useState<React.ReactNode>(null);

    const currentPasswordRef = useRef<HTMLInputElement>(null);
    const newPasswordRef = useRef<HTMLInputElement>(null);

    const isResettingOwnPassword = user?.id === currentUserId;
    const isAuthUser = Boolean(user?.auth_service);
    const shouldShowResetChoices = Boolean(user && !isResettingOwnPassword && !isAuthUser);
    const passwordStrength = useMemo(() => {
        if (!shouldShowResetChoices || resetMethod !== 'manual') {
            return 0;
        }

        return getPasswordStrength(newPassword, passwordConfig);
    }, [newPassword, passwordConfig, resetMethod, shouldShowResetChoices]);
    const {
        copiedRecently,
        onClick: handleCopyPassword,
    } = useCopyText({text: newPassword});

    const handleCancel = useCallback(() => {
        setShow(false);
    }, []);

    const ensureGeneratedPassword = useCallback(() => {
        setNewPassword((currentValue) => currentValue || generatePassword(passwordConfig));
    }, [passwordConfig]);

    useEffect(() => {
        if (shouldShowResetChoices && resetMethod === 'manual') {
            ensureGeneratedPassword();
            newPasswordRef.current?.focus();
        }
    }, [ensureGeneratedPassword, resetMethod, shouldShowResetChoices]);

    const handleGeneratePassword = useCallback(() => {
        setNewPassword(generatePassword(passwordConfig));
        setErrorNewPass(null);
    }, [passwordConfig]);

    const handleResetMethodChange = useCallback((nextMethod: ResetMethod) => {
        setResetMethod(nextMethod);
        setModalError(null);
        setErrorNewPass(null);
    }, []);

    const handleConfirm = useCallback(async () => {
        if (!user) {
            return;
        }

        setErrorNewPass(null);
        setModalError(null);

        if (shouldShowResetChoices && resetMethod === 'email') {
            const result = await actions.sendPasswordResetEmail(user.email);

            if ('error' in result) {
                setModalError(result.error.message);
                return;
            }

            onSuccess?.();
            setShow(false);
            return;
        }

        if (isResettingOwnPassword && currentPassword === '') {
            setModalError(formatMessage({
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
            setModalError(result.error.message);
            return;
        }

        onSuccess?.();
        setShow(false);
    }, [
        actions,
        currentPassword,
        formatMessage,
        isResettingOwnPassword,
        newPassword,
        onSuccess,
        passwordConfig,
        resetMethod,
        shouldShowResetChoices,
        user,
    ]);

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
    const adminResetTitle = formatMessage({
        id: 'admin.reset_password.title',
        defaultMessage: 'Reset password',
    });
    const adminResetSubtitle = formatMessage({
        id: 'admin.reset_password.subtitle',
        defaultMessage: 'Resetting password for {email}',
    }, {email: user.email});
    const resetMethodLegend = formatMessage({
        id: 'admin.reset_password.method',
        defaultMessage: 'Reset password method',
    });
    const emailOptionTitle = formatMessage({
        id: 'admin.reset_password.option.email.title',
        defaultMessage: 'Send password reset link',
    });
    const emailOptionDescription = formatMessage({
        id: 'admin.reset_password.option.email.description',
        defaultMessage: 'The user will receive an email with a link to choose their own password.',
    });
    const manualOptionTitle = formatMessage({
        id: 'admin.reset_password.option.manual.title',
        defaultMessage: 'Set password manually',
    });
    const manualOptionDescription = formatMessage({
        id: 'admin.reset_password.option.manual.description',
        defaultMessage: 'Enter a new password for this user directly.',
    });
    const strengthLabels = [
        '',
        formatMessage({
            id: 'admin.reset_password.strength.weak',
            defaultMessage: 'Weak',
        }),
        formatMessage({
            id: 'admin.reset_password.strength.fair',
            defaultMessage: 'Fair',
        }),
        formatMessage({
            id: 'admin.reset_password.strength.strong',
            defaultMessage: 'Strong',
        }),
        formatMessage({
            id: 'admin.reset_password.strength.veryStrong',
            defaultMessage: 'Very strong',
        }),
    ];
    const confirmButtonText = shouldShowResetChoices ?
        formatMessage(resetMethod === 'manual' ? {
            id: 'admin.reset_password.resetPassword',
            defaultMessage: 'Reset password',
        } : {
            id: 'admin.reset_password.sendLink',
            defaultMessage: 'Send reset link',
        }) :
        formatMessage({
            id: 'admin.reset_password.reset',
            defaultMessage: 'Reset',
        });

    return (
        <GenericModal
            id='resetPasswordModal'
            className='ResetPasswordModal'
            modalHeaderText={shouldShowResetChoices ? adminResetTitle : title}
            modalSubheaderText={shouldShowResetChoices ? adminResetSubtitle : undefined}
            show={show}
            onExited={onExited}
            onHide={handleCancel}
            handleCancel={handleCancel}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            confirmButtonText={confirmButtonText}
            compassDesign={true}
            autoCloseOnConfirmButton={false}
            errorText={modalError ? <span className='error'>{modalError}</span> : undefined}
        >
            <div className='ResetPasswordModal__body'>
                {shouldShowResetChoices && (
                    <>
                        <p className='ResetPasswordModal__description'>
                            {formatMessage({
                                id: 'admin.reset_password.description',
                                defaultMessage: 'Choose how you\'d like to reset this user\'s password.',
                            })}
                        </p>
                        <fieldset className='ResetPasswordModal__choices'>
                            <legend className='sr-only'>{resetMethodLegend}</legend>
                            <div className={`ResetPasswordModal__choice${resetMethod === 'email' ? ' ResetPasswordModal__choice--selected' : ''}`}>
                                <input
                                    id='resetPasswordModalSendLink'
                                    className='ResetPasswordModal__choice-input'
                                    type='radio'
                                    name='resetMethod'
                                    value='email'
                                    checked={resetMethod === 'email'}
                                    onChange={() => handleResetMethodChange('email')}
                                    aria-describedby='resetPasswordModalSendLinkDescription'
                                />
                                <span
                                    className='ResetPasswordModal__choice-control'
                                    aria-hidden='true'
                                />
                                <div className='ResetPasswordModal__choice-content'>
                                    <label
                                        htmlFor='resetPasswordModalSendLink'
                                        className='ResetPasswordModal__choice-title'
                                    >
                                        {emailOptionTitle}
                                    </label>
                                    <span
                                        id='resetPasswordModalSendLinkDescription'
                                        className='ResetPasswordModal__choice-description'
                                    >
                                        {emailOptionDescription}
                                    </span>
                                </div>
                            </div>
                            <div className={`ResetPasswordModal__choice${resetMethod === 'manual' ? ' ResetPasswordModal__choice--selected' : ''}`}>
                                <input
                                    id='resetPasswordModalManual'
                                    className='ResetPasswordModal__choice-input'
                                    type='radio'
                                    name='resetMethod'
                                    value='manual'
                                    checked={resetMethod === 'manual'}
                                    onChange={() => handleResetMethodChange('manual')}
                                    aria-describedby='resetPasswordModalManualDescription'
                                />
                                <span
                                    className='ResetPasswordModal__choice-control'
                                    aria-hidden='true'
                                />
                                <div className='ResetPasswordModal__choice-content'>
                                    <label
                                        htmlFor='resetPasswordModalManual'
                                        className='ResetPasswordModal__choice-title'
                                    >
                                        {manualOptionTitle}
                                    </label>
                                    <span
                                        id='resetPasswordModalManualDescription'
                                        className='ResetPasswordModal__choice-description'
                                    >
                                        {manualOptionDescription}
                                    </span>
                                </div>
                            </div>
                        </fieldset>
                    </>
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
                {(!shouldShowResetChoices || resetMethod === 'manual') && (
                    <div className='ResetPasswordModal__manual-section'>
                        {shouldShowResetChoices && (
                            <div className='ResetPasswordModal__manual-actions'>
                                <span className='ResetPasswordModal__manual-label'>
                                    {formatMessage({
                                        id: 'admin.reset_password.newPassword',
                                        defaultMessage: 'New password',
                                    })}
                                </span>
                                <button
                                    type='button'
                                    className='ResetPasswordModal__generate'
                                    onClick={handleGeneratePassword}
                                >
                                    <RefreshIcon size={18}/>
                                    <span>
                                        {formatMessage({
                                            id: 'admin.reset_password.generate',
                                            defaultMessage: 'Generate random',
                                        })}
                                    </span>
                                </button>
                            </div>
                        )}
                        <Input
                            ref={newPasswordRef as React.Ref<HTMLInputElement>}
                            type='text'
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
                            autoFocus={!isResettingOwnPassword && !shouldShowResetChoices}
                            customMessage={errorNewPass ? {type: 'error', value: errorNewPass} : undefined}
                            inputSuffix={shouldShowResetChoices ? (
                                <button
                                    type='button'
                                    className='ResetPasswordModal__password-copy'
                                    onClick={handleCopyPassword}
                                    aria-label={formatMessage({
                                        id: 'admin.reset_password.copyGeneratedPassword',
                                        defaultMessage: 'Copy generated password',
                                    })}
                                >
                                    {copiedRecently ? <CheckIcon size={18}/> : <ContentCopyIcon size={18}/>}
                                </button>
                            ) : undefined}
                        />
                        {shouldShowResetChoices && Boolean(passwordStrength) && (
                            <div className='ResetPasswordModal__strength'>
                                <div
                                    className='ResetPasswordModal__strength-bars'
                                    aria-hidden='true'
                                >
                                    {Array.from({length: PASSWORD_SEGMENTS}).map((_, index) => (
                                        <span
                                            key={index}
                                            className={`ResetPasswordModal__strength-bar${index < passwordStrength ? ' ResetPasswordModal__strength-bar--active' : ''}`}
                                        />
                                    ))}
                                </div>
                                <span className='ResetPasswordModal__strength-label'>
                                    {strengthLabels[passwordStrength]}
                                </span>
                            </div>
                        )}
                    </div>
                )}
                {shouldShowResetChoices && resetMethod === 'email' && (
                    <div className='ResetPasswordModal__notice'>
                        <InformationOutlineIcon size={18}/>
                        <span>
                            {formatMessage({
                                id: 'admin.reset_password.notice',
                                defaultMessage: 'A password reset email will be sent to the user\'s email address. The link will expire after 24 hours.',
                            })}
                        </span>
                    </div>
                )}
            </div>
        </GenericModal>
    );
}
