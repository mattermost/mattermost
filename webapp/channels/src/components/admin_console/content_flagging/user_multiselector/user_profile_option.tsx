// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import type {OptionProps} from 'react-select';

import type {UserProfile} from '@mattermost/types/users';

import Avatar from 'components/widgets/users/avatar';

import {getDisplayNameByUser, imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import type {AutocompleteOptionType} from './user_multiselector';

import './user_profile_option.scss';

export function MultiUserOptionComponent(props: OptionProps<AutocompleteOptionType<UserProfile>, true>) {
    const {data, innerProps} = props;

    const userProfile = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => getDisplayNameByUser(state, userProfile));

    return (
        <div
            className='UserOptionComponent'
            {...innerProps}
        >
            <Avatar
                size='xxs'
                username={userProfile?.username}
                url={imageURLForUser(data.value)}
            />

            {userDisplayName}
        </div>
    );
}

export function SingleUserOptionComponent(props: OptionProps<AutocompleteOptionType<UserProfile>, false>) {
    const {data, innerProps} = props;

    const userProfile = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => getDisplayNameByUser(state, userProfile));

    return (
        <div
            className='UserOptionComponent'
            {...innerProps}
        >
            <Avatar
                size='xxs'
                username={userProfile?.username}
                url={imageURLForUser(data.value)}
            />

            {userDisplayName}
        </div>
    );
}
