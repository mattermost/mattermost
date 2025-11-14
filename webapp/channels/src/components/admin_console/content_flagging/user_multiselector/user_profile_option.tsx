// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import type {OptionProps} from 'react-select';

import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import Avatar from 'components/widgets/users/avatar';

import {getDisplayNameByUser, imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {GroupTeamDisplay} from './group_team_display';
import type {AutocompleteOptionType} from './user_multiselector';

import './user_profile_option.scss';

// Helper function to check if an option is a user
const isUser = (option: UserProfile | Group | Team): option is UserProfile => {
    return (option as UserProfile).username !== undefined;
};

// Helper function to check if an option is a team
const isTeam = (option: UserProfile | Group | Team): option is Team => {
    return (option as Team).type !== undefined;
};

export function MultiUserOptionComponent(props: OptionProps<AutocompleteOptionType<UserProfile | Group | Team>, true>) {
    const {data, innerProps} = props;

    const item = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => {
        if (item && isUser(item)) {
            return getDisplayNameByUser(state, item);
        }
        return '';
    });

    // Render user option
    if (item && isUser(item)) {
        return (
            <div
                className='UserOptionComponent'
                {...innerProps}
            >
                <Avatar
                    size='xxs'
                    username={item.username}
                    url={imageURLForUser(data.value)}
                />

                {userDisplayName}
            </div>
        );
    }

    // Render team option
    if (item && isTeam(item)) {
        return (
            <div
                className='UserOptionComponent'
                {...innerProps}
            >
                <GroupTeamDisplay
                    item={item}
                    variant='team'
                />
            </div>
        );
    }

    // Render group option
    const group = item as Group;
    return (
        <div
            className='UserOptionComponent'
            {...innerProps}
        >
            <GroupTeamDisplay
                item={group}
                variant='group'
            />
        </div>
    );
}

export function SingleUserOptionComponent(props: OptionProps<AutocompleteOptionType<UserProfile | Group | Team>, false>) {
    const {data, innerProps} = props;

    const item = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => {
        if (item && isUser(item)) {
            return getDisplayNameByUser(state, item);
        }
        return '';
    });

    // Render user option
    if (item && isUser(item)) {
        return (
            <div
                className='UserOptionComponent'
                {...innerProps}
            >
                <Avatar
                    size='xxs'
                    username={item.username}
                    url={imageURLForUser(data.value)}
                />

                {userDisplayName}
            </div>
        );
    }

    // Render team option
    if (item && isTeam(item)) {
        return (
            <div
                className='UserOptionComponent'
                {...innerProps}
            >
                <GroupTeamDisplay
                    item={item}
                    variant='team'
                />
            </div>
        );
    }

    // Render group option
    const group = item as Group;
    return (
        <div
            className='UserOptionComponent'
            {...innerProps}
        >
            <GroupTeamDisplay
                item={group}
                variant='group'
            />
        </div>
    );
}
