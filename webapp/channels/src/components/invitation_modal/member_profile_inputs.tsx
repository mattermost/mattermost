// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {MemberInviteProfile} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import InputError from 'components/input_error';
import Input from 'components/widgets/inputs/input/input';

import {Constants, ValidationErrors} from 'utils/constants';
import {emptyMemberInviteProfile, getEmailsToPreset, getProfileForEmail} from 'utils/member_invite_profiles';
import {isValidUsername} from 'utils/utils';

import './member_profile_inputs.scss';

type Props = {
    usersEmails: Array<UserProfile | string>;
    profiles: Record<string, MemberInviteProfile>;
    onProfileChange: (profile: MemberInviteProfile) => void;
};

function getUsernameErrorMessage(username: string, formatMessage: ReturnType<typeof useIntl>['formatMessage']): string | undefined {
    if (!username) {
        return undefined;
    }
    const usernameError = isValidUsername(username);
    if (!usernameError) {
        return undefined;
    }
    if (usernameError.id === ValidationErrors.RESERVED_NAME) {
        return formatMessage({
            id: 'invite_modal.preset_profile.username_reserved',
            defaultMessage: 'This username is reserved.',
        });
    }
    return formatMessage({
        id: 'invite_modal.preset_profile.username_invalid',
        defaultMessage: 'Usernames have to begin with a lowercase letter and be {min}-{max} characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.',
    }, {min: Constants.MIN_USERNAME_LENGTH, max: Constants.MAX_USERNAME_LENGTH});
}

type RowProps = {
    email: string;
    profile: MemberInviteProfile;
    onProfileChange: (profile: MemberInviteProfile) => void;
};

function MemberProfileInputRow({email, profile, onProfileChange}: RowProps) {
    const {formatMessage} = useIntl();
    const [usernameError, setUsernameError] = useState<string | undefined>();
    const emailKey = email.toLowerCase();
    const usernameErrorId = `error_preset-username-${emailKey}`;

    const updateField = (field: 'username' | 'first_name' | 'last_name') => (event: React.ChangeEvent<HTMLInputElement>) => {
        if (field === 'username') {
            setUsernameError(undefined);
        }
        onProfileChange({...profile, [field]: event.target.value});
    };

    const handleUsernameBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const username = event.target.value.toLowerCase();
        if (username !== profile.username) {
            onProfileChange({...profile, username});
        }
        setUsernameError(getUsernameErrorMessage(username, formatMessage));
    };

    return (
        <div
            className='MemberProfileInputs__row'
            data-testid={`MemberProfileInputs__row-${emailKey}`}
        >
            <div className='MemberProfileInputs__email'>{email}</div>
            <div className='MemberProfileInputs__fields'>
                <Input
                    name={`preset-first-name-${emailKey}`}
                    type='text'
                    value={profile.first_name}
                    onChange={updateField('first_name')}
                    maxLength={Constants.MAX_FIRSTNAME_LENGTH}
                    placeholder={formatMessage({id: 'invite_modal.preset_profile.first_name', defaultMessage: 'First name'})}
                    aria-label={formatMessage({id: 'invite_modal.preset_profile.first_name', defaultMessage: 'First name'})}
                />
                <Input
                    name={`preset-last-name-${emailKey}`}
                    type='text'
                    value={profile.last_name}
                    onChange={updateField('last_name')}
                    maxLength={Constants.MAX_LASTNAME_LENGTH}
                    placeholder={formatMessage({id: 'invite_modal.preset_profile.last_name', defaultMessage: 'Last name'})}
                    aria-label={formatMessage({id: 'invite_modal.preset_profile.last_name', defaultMessage: 'Last name'})}
                />
                <Input
                    name={`preset-username-${emailKey}`}
                    type='text'
                    value={profile.username}
                    onChange={updateField('username')}
                    onBlur={handleUsernameBlur}
                    maxLength={Constants.MAX_USERNAME_LENGTH}
                    autoCapitalize='off'
                    placeholder={formatMessage({id: 'invite_modal.preset_profile.username', defaultMessage: 'Username'})}
                    aria-label={formatMessage({id: 'invite_modal.preset_profile.username', defaultMessage: 'Username'})}
                    hasError={Boolean(usernameError)}
                    aria-describedby={usernameError ? usernameErrorId : undefined}
                />
            </div>
            {usernameError && (
                <div
                    id={usernameErrorId}
                    className='MemberProfileInputs__error'
                    role='alert'
                >
                    <InputError message={usernameError}/>
                </div>
            )}
        </div>
    );
}

export default function MemberProfileInputs(props: Props) {
    const emails = getEmailsToPreset(props.usersEmails);
    if (emails.length === 0) {
        return null;
    }

    return (
        <div
            className='MemberProfileInputs'
            data-testid='MemberProfileInputs'
        >
            <div className='InviteView__sectionTitle'>
                <FormattedMessage
                    id='invite_modal.preset_profile.title'
                    defaultMessage='Set profile details for invited members'
                />
            </div>
            <div className='MemberProfileInputs__help'>
                <FormattedMessage
                    id='invite_modal.preset_profile.help'
                    defaultMessage='These fields are locked for members once they join, so double-check them before sending. Leave a row empty to let that person fill in their own details.'
                />
            </div>
            {emails.map((email) => {
                const profile = getProfileForEmail(props.profiles, email) ?? emptyMemberInviteProfile(email);
                return (
                    <MemberProfileInputRow
                        key={email.toLowerCase()}
                        email={email}
                        profile={profile}
                        onProfileChange={props.onProfileChange}
                    />
                );
            })}
        </div>
    );
}
