// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {components} from 'react-select';
import type {OptionProps} from 'react-select';

import type {AppSelectOption} from '@mattermost/types/apps';
import type {UserProfile} from '@mattermost/types/users';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';
import Avatar from 'components/widgets/users/avatar/avatar';

import * as Utils from 'utils/utils';
import {imageURLForUser} from 'utils/utils';

const getDescription = (data: UserProfile): string => {
    if ((data.first_name || data.last_name) && data.nickname) {
        return ` - ${Utils.getFullName(data)} (${data.nickname})`;
    } else if (data.nickname) {
        return ` - (${data.nickname})`;
    } else if (data.first_name || data.last_name) {
        return ` - ${Utils.getFullName(data)}`;
    }
    return '';
};

const {Option} = components;

export const SelectUserOption = (props: OptionProps<AppSelectOption>) => {
    const username = props.data.username;
    const description = getDescription(props.data);

    return (
        <Option
            className='apps-form-select-option'
            {...props}
        >
            <div className='select-option-item'>
                <Avatar
                    size='xxs'
                    username={username}
                    url={imageURLForUser(props.data.id)}
                />
                <div className='select-option-item-label'>
                    <span className='select-option-main'>
                        {'@' + username}
                    </span>
                    <span>
                        {' '}
                        {description}
                    </span>
                </div>
                {props.data.is_bot && <BotTag/>}
                {isGuest(props.data.roles) && <GuestTag/>}
            </div>
        </Option>
    );
};
