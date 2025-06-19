// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {userCanSeeOtherUser} from 'mattermost-redux/selectors/entities/users';

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
    const canMessage = useSelector((state: GlobalState) => {
        const result = userCanSeeOtherUser(state, user.id);
        // eslint-disable-next-line no-console
        console.log(`[DEBUG] ProfilePopoverOtherUserRow: userCanSeeOtherUser for ${user.username} (${user.id}): ${result}`, {
            userId: user.id,
            username: user.username,
            remoteId: user.remote_id,
            canMessage: result,
        });
        return result;
    });
    const isSharedChannelsDMsEnabled = useSelector((state: GlobalState) => {
        const enabled = getFeatureFlagValue(state, 'EnableSharedChannelsDMs') === 'true';
        // eslint-disable-next-line no-console
        console.log(`[DEBUG] ProfilePopoverOtherUserRow: EnableSharedChannelsDMs feature flag: ${enabled}`);
        return enabled;
    });

    if (user.id === currentUserId || haveOverrideProp) {
        return null;
    }

    // Hide Message button for remote users when EnableSharedChannelsDMs feature flag is off
    const isRemoteUser = Boolean(user.remote_id);
    const showMessageButton = isSharedChannelsDMsEnabled || !isRemoteUser;

    // eslint-disable-next-line no-console
    console.log(`[DEBUG] ProfilePopoverOtherUserRow: Button visibility logic for ${user.username}`, {
        isRemoteUser,
        isSharedChannelsDMsEnabled,
        showMessageButton,
        canMessage,
        finalButtonVisible: showMessageButton && (canMessage || !canMessage), // Always show button (enabled/disabled based on canMessage)
    });

    return (
        <div className='user-popover__bottom-row-container'>
            {showMessageButton && (
                <>
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
                </>
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
