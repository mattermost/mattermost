// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import type {OptionProps} from 'react-select';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import Avatar from 'components/widgets/users/avatar';

import {getDisplayNameByUser, imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import type {AutocompleteOptionType} from './user_multiselector';

import './user_profile_option.scss';

// Helper function to check if an option is a user
const isUser = (option: UserProfile | Group): option is UserProfile => {
    return (option as UserProfile).username !== undefined;
};

export function MultiUserOptionComponent(props: OptionProps<AutocompleteOptionType<UserProfile | Group>, true>) {
    const {data, innerProps} = props;

    const userOrGroup = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => {
        if (userOrGroup && isUser(userOrGroup)) {
            return getDisplayNameByUser(state, userOrGroup);
        }
        return '';
    });

    // Render user option
    if (userOrGroup && isUser(userOrGroup)) {
        return (
            <div
                className='UserOptionComponent'
                {...innerProps}
            >
                <Avatar
                    size='xxs'
                    username={userOrGroup.username}
                    url={imageURLForUser(data.value)}
                />

                {userDisplayName}
            </div>
        );
    }

    // Render group option
    const group = userOrGroup as Group;
    return (
        <div
            className='UserOptionComponent'
            {...innerProps}
        >
            <div className='GroupIcon'>
                {'G'}
            </div>

            <span className='GroupLabel'>
                <span>{group.display_name || group.name}</span>
                {group.source === 'ldap' && <span className='GroupSource'>{'(AD/LDAP)'}</span>}
            </span>
        </div>
    );
}

export function SingleUserOptionComponent(props: OptionProps<AutocompleteOptionType<UserProfile | Group>, false>) {
    const {data, innerProps} = props;

    const userOrGroup = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => {
        if (userOrGroup && isUser(userOrGroup)) {
            return getDisplayNameByUser(state, userOrGroup);
        }
        return '';
    });

    // Render user option
    if (userOrGroup && isUser(userOrGroup)) {
        return (
            <div
                className='UserOptionComponent'
                {...innerProps}
            >
                <Avatar
                    size='xxs'
                    username={userOrGroup.username}
                    url={imageURLForUser(data.value)}
                />

                {userDisplayName}
            </div>
        );
    }

    // Render group option
    const group = userOrGroup as Group;
    return (
        <div
            className='UserOptionComponent'
            {...innerProps}
        >
            <div className='GroupIcon'>
                {'G'}
            </div>

            <span className='GroupLabel'>
                <span>{group.display_name || group.name}</span>
                {group.source === 'ldap' && <span className='GroupSource'>{'(AD/LDAP)'}</span>}
            </span>
        </div>
    );
}
