// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JSX} from 'react';
import React from 'react';
import {useSelector} from 'react-redux';
import type {SingleValueProps} from 'react-select';
import type {MultiValueProps} from 'react-select/dist/declarations/src/components/MultiValue';

import type {Group} from '@mattermost/types/groups';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import CloseCircleSolidIcon from 'components/widgets/icons/close_circle_solid_icon';
import Avatar from 'components/widgets/users/avatar/avatar';

import {getDisplayNameByUser, imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {GroupTeamDisplay} from './group_team_display';
import type {AutocompleteOptionType} from './user_multiselector';

import './user_profile_pill.scss';

// Helper function to check if an option is a user
const isUser = (option: UserProfile | Group | Team): option is UserProfile => {
    return (option as UserProfile).username !== undefined;
};

// Helper function to check if an option is a team
const isTeam = (option: UserProfile | Group | Team): option is Team => {
    return (option as Team).type !== undefined;
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

export function MultiUserProfilePill(props: MultiValueProps<AutocompleteOptionType<UserProfile | Group | Team>, true>) {
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

export function SingleUserProfilePill(props: SingleValueProps<AutocompleteOptionType<UserProfile | Group | Team>, false>) {
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
    data: AutocompleteOptionType<UserProfile | Group | Team>;
    innerProps: JSX.IntrinsicElements['div'];
    selectProps: unknown;
    removeProps?: JSX.IntrinsicElements['div'];
}

function BaseUserProfilePill({data, innerProps, selectProps, removeProps}: Props) {
    const item = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => {
        if (item && isUser(item)) {
            return getDisplayNameByUser(state, item);
        }
        return '';
    });

    // Render user pill
    if (item && isUser(item)) {
        return (
            <div
                className='UserProfilePill'
                {...innerProps}
            >
                <Avatar
                    size='xxs'
                    username={item.username}
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

    // Render team pill
    if (item && isTeam(item)) {
        return (
            <div
                className='UserProfilePill'
                {...innerProps}
            >
                <GroupTeamDisplay
                    item={item}
                    variant='team'
                    displayMode='chip'
                />
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
    const group = item as Group;
    return (
        <div
            className='UserProfilePill'
            {...innerProps}
        >
            <GroupTeamDisplay
                item={group}
                variant='group'
                displayMode='chip'
            />
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
