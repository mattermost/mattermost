// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import type {MultiValueProps} from 'react-select/dist/declarations/src/components/MultiValue';

import type {UserProfile} from '@mattermost/types/users';

import CloseCircleSolidIcon from 'components/widgets/icons/close_circle_solid_icon';
import Avatar from 'components/widgets/users/avatar/avatar';

import {getDisplayNameByUser, imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import type {AutocompleteOptionType} from './user_multiselector';

import './user_profile_pill.scss';

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

export function UserProfilePill(props: MultiValueProps<AutocompleteOptionType<UserProfile>, true>) {
    const {data, innerProps, selectProps, removeProps} = props;

    const userProfile = data.raw;
    const userDisplayName = useSelector((state: GlobalState) => getDisplayNameByUser(state, userProfile));

    return (
        <div
            className='UserProfilePill'
            {...innerProps}
        >
            <Avatar
                size='xxs'
                username={userProfile?.username}
                url={imageURLForUser(data.value)}
            />

            {userDisplayName}

            <Remove
                data={data}
                innerProps={innerProps}
                selectProps={selectProps}
                {...removeProps}
            />
        </div>
    );
}
