// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {MemberInviteProfile} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

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

export default function MemberProfileInputs(props: Props) {
    const {formatMessage} = useIntl();

    const emails = getEmailsToPreset(props.usersEmails);
    if (emails.length === 0) {
        return null;
    }

    const validateUsername = (username: string) => {
        if (!username) {
            return undefined;
        }
        const usernameError = isValidUsername(username);
        if (!usernameError) {
            return undefined;
        }
        if (usernameError.id === ValidationErrors.RESERVED_NAME) {
            return {
                type: 'error' as const,
                value: formatMessage({
                    id: 'invite_modal.preset_profile.username_reserved',
                    defaultMessage: 'This username is reserved.',
                }),
            };
        }
        return {
            type: 'error' as const,
            value: formatMessage({
                id: 'invite_modal.preset_profile.username_invalid',
                defaultMessage: 'Usernames have to begin with a lowercase letter and be {min}-{max} characters long. You can use lowercase letters, numbers, periods, dashes, and underscores.',
            }, {min: Constants.MIN_USERNAME_LENGTH, max: Constants.MAX_USERNAME_LENGTH}),
        };
    };

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
                const updateField = (field: 'username' | 'first_name' | 'last_name') => (event: React.ChangeEvent<HTMLInputElement>) => {
                    props.onProfileChange({...profile, [field]: event.target.value});
                };
                return (
                    <div
                        className='MemberProfileInputs__row'
                        data-testid={`MemberProfileInputs__row-${email.toLowerCase()}`}
                        key={email.toLowerCase()}
                    >
                        <div className='MemberProfileInputs__email'>{email}</div>
                        <div className='MemberProfileInputs__fields'>
                            <Input
                                name={`preset-first-name-${email.toLowerCase()}`}
                                type='text'
                                value={profile.first_name}
                                onChange={updateField('first_name')}
                                maxLength={Constants.MAX_FIRSTNAME_LENGTH}
                                placeholder={formatMessage({id: 'invite_modal.preset_profile.first_name', defaultMessage: 'First name'})}
                                aria-label={formatMessage({id: 'invite_modal.preset_profile.first_name', defaultMessage: 'First name'})}
                            />
                            <Input
                                name={`preset-last-name-${email.toLowerCase()}`}
                                type='text'
                                value={profile.last_name}
                                onChange={updateField('last_name')}
                                maxLength={Constants.MAX_LASTNAME_LENGTH}
                                placeholder={formatMessage({id: 'invite_modal.preset_profile.last_name', defaultMessage: 'Last name'})}
                                aria-label={formatMessage({id: 'invite_modal.preset_profile.last_name', defaultMessage: 'Last name'})}
                            />
                            <Input
                                name={`preset-username-${email.toLowerCase()}`}
                                type='text'
                                value={profile.username}
                                onChange={updateField('username')}
                                maxLength={Constants.MAX_USERNAME_LENGTH}
                                autoCapitalize='off'
                                placeholder={formatMessage({id: 'invite_modal.preset_profile.username', defaultMessage: 'Username'})}
                                aria-label={formatMessage({id: 'invite_modal.preset_profile.username', defaultMessage: 'Username'})}
                                customMessage={validateUsername(profile.username)}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
