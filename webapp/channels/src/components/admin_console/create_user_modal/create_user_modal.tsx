// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import {GenericModal} from '@mattermost/components';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {isEmail} from 'mattermost-redux/utils/helpers';

import Input from 'components/widgets/inputs/input/input';

import Constants, {ValidationErrors} from 'utils/constants';
import {isValidPassword} from 'utils/password';
import {isValidUsername} from 'utils/utils';

import '../admin_modal_with_input.scss';

interface PasswordConfig {
    minimumLength: number;
    requireLowercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
    requireUppercase: boolean;
}

type Props = {
    onExited: () => void;
    passwordConfig: PasswordConfig;
    actions: {
        createUser: (user: UserProfile, token: string, inviteId: string, redirect: string) => Promise<ActionResult<UserProfile>>;
    };
}

export default function CreateUserModal({
    onExited,
    passwordConfig,
    actions,
}: Props) {
    const {formatMessage} = useIntl();
    const history = useHistory();

    const [show, setShow] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    const [error, setError] = useState<React.ReactNode>(null);
    const [emailError, setEmailError] = useState<React.ReactNode>(null);
    const [usernameError, setUsernameError] = useState<React.ReactNode>(null);
    const [passwordError, setPasswordError] = useState<React.ReactNode>(null);

    const handleCancel = useCallback(() => {
        setShow(false);
    }, []);

    const validate = useCallback((): boolean => {
        setError(null);
        setEmailError(null);
        setUsernameError(null);
        setPasswordError(null);

        let isValid = true;

        if (!email || !isEmail(email)) {
            setEmailError(formatMessage({
                id: 'admin.create_user.invalidEmail',
                defaultMessage: 'Please enter a valid email address.',
            }));
            isValid = false;
        }

        const usernameValidationError = isValidUsername(username);
        if (usernameValidationError) {
            if (usernameValidationError.id === ValidationErrors.RESERVED_NAME) {
                setUsernameError(formatMessage({
                    id: 'admin.create_user.reservedUsername',
                    defaultMessage: 'This username is reserved, please choose a new one.',
                }));
            } else {
                setUsernameError(formatMessage({
                    id: 'admin.create_user.invalidUsername',
                    defaultMessage: 'Usernames have to begin with a lowercase letter and be {min}-{max} characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.',
                }, {
                    min: Constants.MIN_USERNAME_LENGTH,
                    max: Constants.MAX_USERNAME_LENGTH,
                }));
            }
            isValid = false;
        }

        const {valid, error: passwordValidationError} = isValidPassword(password, passwordConfig);
        if (!valid && passwordValidationError) {
            setPasswordError(passwordValidationError);
            isValid = false;
        }

        return isValid;
    }, [email, username, password, passwordConfig, formatMessage]);

    const handleConfirm = useCallback(async () => {
        if (!validate()) {
            return;
        }

        const user = {
            email: email.trim().toLowerCase(),
            username: username.trim().toLowerCase(),
            password,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
        } as UserProfile;

        const result = await actions.createUser(user, '', '', '');

        if ('error' in result && result.error) {
            const serverErrorId = result.error.server_error_id;
            if (serverErrorId === 'app.user.save.email_exists.app_error' || serverErrorId === 'api.user.create_user.accepted_domain.app_error') {
                setEmailError(result.error.message);
            } else if (serverErrorId === 'app.user.save.username_exists.app_error') {
                setUsernameError(result.error.message);
            } else {
                setError(result.error.message);
            }
            return;
        }

        const created = result.data;
        setShow(false);
        if (created) {
            history.push(`/admin_console/user_management/user/${created.id}`);
        }
    }, [validate, email, username, password, firstName, lastName, actions, history]);

    return (
        <GenericModal
            id='createUserModal'
            className='CreateUserModal'
            modalHeaderText={formatMessage({
                id: 'admin.create_user.title',
                defaultMessage: 'Create user',
            })}
            show={show}
            onExited={onExited}
            onHide={handleCancel}
            handleCancel={handleCancel}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            confirmButtonText={formatMessage({
                id: 'admin.create_user.createButton',
                defaultMessage: 'Create user',
            })}
            compassDesign={true}
            autoCloseOnConfirmButton={false}
            errorText={error ? <span className='error'>{error}</span> : undefined}
            dataTestId='createUserModal'
        >
            <div className='CreateUserModal__body'>
                <Input
                    type='email'
                    name='email'
                    autoComplete='off'
                    label={formatMessage({
                        id: 'admin.create_user.email',
                        defaultMessage: 'Email',
                    })}
                    placeholder={formatMessage({
                        id: 'admin.create_user.enterEmail',
                        defaultMessage: 'Enter email address',
                    })}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus={true}
                    maxLength={128}
                    customMessage={emailError ? {type: 'error', value: emailError} : undefined}
                />
                <Input
                    type='text'
                    name='username'
                    autoComplete='off'
                    label={formatMessage({
                        id: 'admin.create_user.username',
                        defaultMessage: 'Username',
                    })}
                    placeholder={formatMessage({
                        id: 'admin.create_user.enterUsername',
                        defaultMessage: 'Enter username',
                    })}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={Constants.MAX_USERNAME_LENGTH}
                    customMessage={usernameError ? {type: 'error', value: usernameError} : undefined}
                />
                <Input
                    type='password'
                    name='password'
                    autoComplete='new-password'
                    label={formatMessage({
                        id: 'admin.create_user.password',
                        defaultMessage: 'Password',
                    })}
                    placeholder={formatMessage({
                        id: 'admin.create_user.enterPassword',
                        defaultMessage: 'Enter password',
                    })}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    customMessage={passwordError ? {type: 'error', value: passwordError} : undefined}
                />
                <Input
                    type='text'
                    name='firstName'
                    autoComplete='off'
                    label={formatMessage({
                        id: 'admin.create_user.firstName',
                        defaultMessage: 'First name (optional)',
                    })}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={64}
                />
                <Input
                    type='text'
                    name='lastName'
                    autoComplete='off'
                    label={formatMessage({
                        id: 'admin.create_user.lastName',
                        defaultMessage: 'Last name (optional)',
                    })}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={64}
                />
            </div>
        </GenericModal>
    );
}
