// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
<<<<<<< HEAD
import {FormattedMessage, useIntl} from 'react-intl';
=======
import {FormattedMessage} from 'react-intl';
>>>>>>> master
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

<<<<<<< HEAD
import {userCanSeeOtherUser} from 'mattermost-redux/selectors/entities/users';
=======
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
>>>>>>> master

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
    const intl = useIntl();

    // Check if this user can be messaged directly
    const canMessage = useSelector((state: GlobalState) =>
        userCanSeeOtherUser(state, user.id),
    );
    const isSharedChannelsDMsEnabled = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'EnableSharedChannelsDMs') === 'true');

    if (user.id === currentUserId || haveOverrideProp) {
        return null;
    }

    // Hide Message button for remote users when EnableSharedChannelsDMs feature flag is off
    const isRemoteUser = Boolean(user.remote_id);
    const showMessageButton = isSharedChannelsDMsEnabled || !isRemoteUser;

    return (
        <div className='user-popover__bottom-row-container'>
            {showMessageButton && canMessage ? (
                <button
                    type='button'
                    className='btn btn-primary btn-sm'
                    onClick={handleShowDirectChannel}
                    aria-label={intl.formatMessage({
                        id: 'user_profile.send.dm.aria_label',
                        defaultMessage: 'Send message to {user}',
                    }, {user: user.username})}
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
            ) : (
                <button
                    type='button'
                    className='btn btn-primary btn-sm disabled'
                    disabled={true}
                    title={intl.formatMessage({
                        id: 'user_profile.send.dm.no_connection',
                        defaultMessage: 'Cannot message users from indirectly connected servers',
                    })}
                    aria-label={intl.formatMessage({
                        id: 'user_profile.send.dm.no_connection.aria_label',
                        defaultMessage: 'Cannot message {user}. Their server is not directly connected.',
                    }, {user: user.username})}
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
