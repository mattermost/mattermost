// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';

import ProfilePopover from 'components/profile_popover';
import StatusIcon from 'components/status_icon';
import StatusIconNew from 'components/status_icon_new';
import Avatar, {getAvatarWidth} from 'components/widgets/users/avatar';
import type {TAvatarSizeToken} from 'components/widgets/users/avatar';

type Props = {
    size?: TAvatarSizeToken;
    isEmoji?: boolean;
    wrapperClass?: string;
    profileSrc?: string;
    src: string;
    isBot?: boolean;
    fromAutoResponder?: boolean;
    status?: string;
    fromWebhook?: boolean;
    userId?: string;
    channelId?: string;
    username?: string;
    overwriteIcon?: string;
    overwriteName?: string;
    newStatusIcon?: boolean;
    statusClass?: string;
}

function ProfilePicture(props: Props) {
    // profileSrc will, if possible, be the original user profile picture even if the icon
    // for the post is overriden, so that the popup shows the user identity
    const profileSrc = typeof props.profileSrc === 'string' && props.profileSrc !== '' ? props.profileSrc : props.src;

    const profileIconClass = `profile-icon ${props.isEmoji ? 'emoji' : ''}`;

    const hideStatus = props.isBot || props.fromAutoResponder || props.fromWebhook;

    if (props.userId) {
        return (
            <ProfilePopover
                triggerComponentClass={classNames('status-wrapper style--none', props.wrapperClass)}
                userId={props.userId}
                src={profileSrc}
                username={props.username}
                channelId={props.channelId}
                hideStatus={hideStatus}
                overwriteIcon={props.overwriteIcon}
                overwriteName={props.overwriteName}
                fromWebhook={props.fromWebhook}
                triggerComponentAs='button'
                triggerComponentStyle={{
                    borderRadius: '50%',
                    width: `${getAvatarWidth(props?.size ?? 'md')}px`,
                    height: `${getAvatarWidth(props?.size ?? 'md')}px`,
                }}
            >
                <>
                    <span className={profileIconClass}>
                        <Avatar
                            username={props.username}
                            size={props.size}
                            url={props.src}
                        />
                    </span>
                    <StatusIcon status={props.status}/>
                </>
            </ProfilePopover>
        );
    }

    return (
        <span
            className={classNames('status-wrapper', 'style--none', props.wrapperClass)}
        >
            <span className={profileIconClass}>
                <Avatar
                    size={props?.size ?? 'md'}
                    url={props.src}
                />
            </span>
            {props.newStatusIcon ? (
                <StatusIconNew
                    className={props.statusClass}
                    status={props.status}
                />
            ) : (
                <StatusIcon status={props.status}/>
            )}
        </span>
    );
}

export default ProfilePicture;
