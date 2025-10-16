// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JSX} from 'react';
import React from 'react';
import {useSelector} from 'react-redux';
import type {SingleValueProps} from 'react-select';
import type {MultiValueProps} from 'react-select/dist/declarations/src/components/MultiValue';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import CloseCircleSolidIcon from 'components/widgets/icons/close_circle_solid_icon';
import Avatar from 'components/widgets/users/avatar/avatar';

import {getDisplayNameByUser, imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import type {AutocompleteOptionType} from './user_multiselector';

import './user_profile_pill.scss';

// Helper function to check if an option is a user
const isUser = (option: UserProfile | Group): option is UserProfile => {
    return (option as UserProfile).username !== undefined;
};

function Remove(props: any) {
    const {innerProps, children} = props;

    return (
        <div
            className='Remove'
            {...innerProps}
            onClick={props.onClick}
        >
            {children || <CloseCircleSolidIcon/>}
        </div>
    );
}

export function MultiUserProfilePill(props: MultiValueProps<AutocompleteOptionType<UserProfile | Group>, true>) {
    const {data, innerProps, selectProps, removeProps} = props;

    return (
        <BaseUserProfilePill
            data={data}
            innerProps={innerProps}
            selectProps={selectProps}
            removeProps={removeProps}
        />
    );
}

export function SingleUserProfilePill(props: SingleValueProps<AutocompleteOptionType<UserProfile | Group>, false>) {
    const {data, innerProps, selectProps} = props;

    return (
        <BaseUserProfilePill
            data={data}
            innerProps={innerProps}
            selectProps={selectProps}
        />
    );
}

type Props = {
    data: AutocompleteOptionType<UserProfile | Group>;
    innerProps: JSX.IntrinsicElements['div'];
    selectProps: unknown;
    removeProps?: JSX.IntrinsicElements['div'];
}

function BaseUserProfilePill({data, innerProps, selectProps, removeProps}: Props) {
    const userOrGroup = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => {
        if (userOrGroup && isUser(userOrGroup)) {
            return getDisplayNameByUser(state, userOrGroup);
        }
        return '';
    });

    // Render user pill
    if (userOrGroup && isUser(userOrGroup)) {
        return (
            <div
                className='UserProfilePill'
                {...innerProps}
            >
                <Avatar
                    size='xxs'
                    username={userOrGroup.username}
                    url={imageURLForUser(data.value)}
                />

                {userDisplayName}

                {
                    removeProps &&
                    <Remove
                        data={data}
                        innerProps={innerProps}
                        selectProps={selectProps}
                        {...removeProps}
                    />
                }
            </div>
        );
    }

    // Render group pill
    const group = userOrGroup as Group;
    return (
        <div
            className='UserProfilePill'
            {...innerProps}
        >
            <div className='GroupIcon'>
                {'G'}
            </div>

            <span className='GroupLabel'>
                <span>{group.display_name || group.name}</span>
                {group.source === 'ldap' && <span className='GroupSource'>{'(AD/LDAP)'}</span>}
            </span>

            {
                removeProps &&
                <Remove
                    data={data}
                    innerProps={innerProps}
                    selectProps={selectProps}
                    {...removeProps}
                />
            }
        </div>
    );
}
