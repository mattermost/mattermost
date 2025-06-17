// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

import ProfilePopoverAddToChannel from 'components/profile_popover/profile_popover_add_to_channel';
import ProfilePopoverCallButtonWrapper from 'components/profile_popover/profile_popover_call_button_wrapper';

import type {GlobalState} from 'types/store';

type Props = {
    user: UserProfile;
    fullname: string;
    currentUserId: string;
    haveOverrideProp: boolean;
    handleShowDirectChannel: (e: React.MouseEvent<HTMLButtonElement>) => void;
    returnFocus: () => void;
    handleCloseModals: () => void;
    hide?: () => void;
};

const ProfilePopoverOtherUserRow = ({
    currentUserId,
    haveOverrideProp,
    user,
    handleShowDirectChannel,
    handleCloseModals,
    returnFocus,
    hide,
    fullname,
}: Props) => {
    const isSharedChannelsDMsEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'EnableSharedChannelsDMs') === 'true');

    if (user.id === currentUserId || haveOverrideProp) {
        return null;
    }

    // Hide Message button for remote users when EnableSharedChannelsDMs feature flag is off
    const isRemoteUser = Boolean(user.remote_id);
    const showMessageButton = isSharedChannelsDMsEnabled || !isRemoteUser;

    return (
        <div className='user-popover__bottom-row-container'>
            {showMessageButton && (
                <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    onClick={handleShowDirectChannel}
                >
                    <i
                        className='icon icon-send'
                        aria-hidden='true'
                    />
                    <FormattedMessage
                        id='user_profile.send.dm'
                        defaultMessage='Message'
                    />
                </button>
            )}
            <div className='user-popover__bottom-row-end'>
                <ProfilePopoverAddToChannel
                    handleCloseModals={handleCloseModals}
                    returnFocus={returnFocus}
                    user={user}
                    hide={hide}
                />
                <ProfilePopoverCallButtonWrapper
                    currentUserId={currentUserId}
                    fullname={fullname}
                    userId={user.id}
                    username={user.username}
                />
            </div>
        </div>
    );
};

export default ProfilePopoverOtherUserRow;
