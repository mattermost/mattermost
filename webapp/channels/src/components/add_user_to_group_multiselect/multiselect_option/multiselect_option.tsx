// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import type {UserProfile} from '@mattermost/types/users';
import type {RelationOneToOne} from '@mattermost/types/utilities';

import {Client4} from 'mattermost-redux/client';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import type {Value} from 'components/multiselect/multiselect';
import ProfilePicture from 'components/profile_picture';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {displayEntireNameForUser} from 'utils/utils';

type UserProfileValue = Value & UserProfile;

type Props = {
    option: UserProfileValue;
    onAdd: (user: UserProfileValue) => void;
    onMouseMove: (user: UserProfileValue) => void;
    userStatuses: RelationOneToOne<UserProfile, string>;
    isSelected: boolean;
}

const MultiSelectOption = React.forwardRef(({
    option,
    onAdd,
    onMouseMove,
    userStatuses,
    isSelected,
}: Props, ref?: React.Ref<HTMLDivElement>) => {
    return (
        <div
            key={option.id}
            className={classNames('more-modal__row clickable', {'more-modal__row--selected': isSelected})}
            onClick={() => onAdd(option)}
            ref={ref}
            onMouseMove={() => onMouseMove(option)}
        >
            <ProfilePicture
                src={Client4.getProfilePictureUrl(option.id, option.last_picture_update)}
                status={userStatuses[option.id]}
                size='md'
                username={option.username}
            />
            <div className='more-modal__details'>
                <div className='more-modal__name'>
                    {displayEntireNameForUser(option)}
                    {option.is_bot && <BotTag/>}
                    {isGuest(option.roles) && <GuestTag className='popoverlist'/>}
                </div>
            </div>
            <div className='more-modal__actions'>
                <button
                    className='more-modal__actions--round'
                    aria-label={`Select Option ${option.label}`}
                >
                    <i
                        className='icon icon-plus'
                    />
                </button>
            </div>
        </div>
    );
});

export default MultiSelectOption;
