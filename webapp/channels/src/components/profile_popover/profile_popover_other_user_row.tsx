// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {canDirectlyMessageUser} from 'mattermost-redux/selectors/entities/users';

import ProfilePopoverAddToChannel from 'components/profile_popover/profile_popover_add_to_channel';
import ProfilePopoverCallButtonWrapper from 'components/profile_popover/profile_popover_call_button_wrapper';

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
    const canMessage = useSelector((state) => 
        canDirectlyMessageUser(state, user.id)
    );
    
    if (user.id === currentUserId || haveOverrideProp) {
        return null;
    }

    return (
        <div className='user-popover__bottom-row-container'>
            {canMessage ? (
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
                        defaultMessage: 'Cannot message users from indirectly connected servers'
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
