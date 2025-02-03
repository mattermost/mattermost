// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React from 'react';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import ProfilePopover from 'components/profile_popover';
import SharedUserIndicator from 'components/shared_user_indicator';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {imageURLForUser} from 'utils/utils';

import {generateColor} from './utils';

import type {OwnProps, PropsFromRedux} from './index';

export type Props = PropsFromRedux & OwnProps;

export default function UserProfile({
    disablePopover = false,
    displayUsername = false,
    hideStatus = false,
    overwriteName = '',
    colorize = false,
    user,
    displayName,
    theme,
    userId,
    channelId,
    overwriteIcon,
}: Props) {
    let name: ReactNode;
    if (user && displayUsername) {
        name = `@${(user.username)}`;
    } else {
        name = overwriteName || displayName || '...';
    }

    let userColor = theme?.centerChannelColor;
    if (user && theme) {
        userColor = generateColor(user.username, theme.centerChannelBg);
    }

    let userStyle;
    if (colorize) {
        userStyle = {color: userColor};
    }

    if (disablePopover) {
        return (
            <div
                className='user-popover'
                style={userStyle}
            >
                {name}
            </div>
        );
    }

    let profileImg = '';
    let userIsRemote = false;
    if (user) {
        profileImg = imageURLForUser(user.id, user.last_picture_update);
        if (user.remote_id) {
            userIsRemote = true;
        }
    }

    return (
        <>
            <ProfilePopover<HTMLButtonElement>
                triggerComponentAs='button'
                triggerComponentClass='user-popover style--none'
                triggerComponentStyle={userStyle}
                userId={userId}
                src={profileImg}
                channelId={channelId}
                hideStatus={hideStatus}
                overwriteIcon={overwriteIcon}
                overwriteName={overwriteName}
            >
                {name}
            </ProfilePopover>
            {userIsRemote &&
            <SharedUserIndicator
                className='shared-user-icon'
                withTooltip={true}
            />
            }
            {(user && user.is_bot) && <BotTag/>}
            {(user && isGuest(user.roles)) && <GuestTag/>}
        </>
    );
}
