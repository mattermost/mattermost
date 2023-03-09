// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import GuestTag from 'components/widgets/tag/guest_tag';

import BotTag from 'components/widgets/tag/bot_tag';

import {Client4} from 'mattermost-redux/client';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import {UserProfile} from '@mattermost/types/users';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';

import ProfilePicture from 'components/profile_picture';

import {displayEntireNameForUser} from 'utils/utils';

type Props = {
    currentUserId: string;
    option: UserProfile;
    status: string;
};

export default function UserDetails(props: Props): JSX.Element {
    const {currentUserId, option, status} = props;
    const {
        id,
        delete_at: deleteAt,
        is_bot: isBot = false,
        last_picture_update: lastPictureUpdate,
    } = option;

    const displayName = displayEntireNameForUser(option);

    let modalName: React.ReactNode = displayName;
    if (option.id === currentUserId) {
        modalName = (
            <FormattedMessage
                id='more_direct_channels.directchannel.you'
                defaultMessage='{displayname} (you)'
                values={{
                    displayname: displayName,
                }}
            />
        );
    } else if (option.delete_at) {
        modalName = (
            <FormattedMessage
                id='more_direct_channels.directchannel.deactivated'
                defaultMessage='{displayname} - Deactivated'
                values={{
                    displayname: displayName,
                }}
            />
        );
    }

    return (
        <>
            <ProfilePicture
                src={Client4.getProfilePictureUrl(id, lastPictureUpdate)}
                status={!deleteAt && !isBot ? status : undefined}
                size='md'
            />
            <div className='more-modal__details'>
                <div className='more-modal__name'>
                    {modalName}
                    {isBot && <BotTag/>}
                    {isGuest(option.roles) && <GuestTag/>}
                    <CustomStatusEmoji
                        userID={option.id}
                        showTooltip={true}
                        emojiSize={15}
                    />
                </div>
                {!isBot && (
                    <div className='more-modal__description'>
                        {option.email}
                    </div>
                )}
            </div>
        </>
    );
}
