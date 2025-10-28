// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector, useDispatch} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';

import {canUserDirectMessage} from 'actions/user_actions';

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
    const dispatch = useDispatch();

    const [canMessage, setCanMessage] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const isSharedChannelsDMsEnabled = useSelector((state: GlobalState) => {
        return getFeatureFlagValue(state, 'EnableSharedChannelsDMs') === 'true';
    });

    // Check if this user can be messaged directly using server-side validation
    useEffect(() => {
        const checkCanMessage = async () => {
            if (!user.remote_id) {
                // Local users can always be messaged
                setCanMessage(true);
                return;
            }

            if (!isSharedChannelsDMsEnabled) {
                // Feature disabled - don't allow remote user messaging
                setCanMessage(false);
                return;
            }

            setIsLoading(true);
            try {
                const result = await dispatch(canUserDirectMessage(currentUserId, user.id));
                if (result.data) {
                    setCanMessage(result.data.can_dm);
                } else {
                    setCanMessage(false);
                }
            } catch (error) {
                // Error checking DM permissions
                setCanMessage(false);
            } finally {
                setIsLoading(false);
            }
        };

        checkCanMessage();
    }, [dispatch, currentUserId, user.id, user.remote_id, isSharedChannelsDMsEnabled]);

    if (user.id === currentUserId || haveOverrideProp) {
        return null;
    }

    // For remote users, we need to check permissions; for local users, always show
    const isRemoteUser = Boolean(user.remote_id);
    const shouldShowButton = !isRemoteUser || (isSharedChannelsDMsEnabled && canMessage !== null);

    return (
        <div className='user-popover__bottom-row-container'>
            {shouldShowButton && (
                <>
                    {isLoading ? (
                        <button
                            type='button'
                            className='btn btn-primary btn-sm disabled'
                            disabled={true}
                        >
                            <i
                                className='icon icon-loading'
                                aria-hidden='true'
                            />
                            <FormattedMessage
                                id='user_profile.send.dm.checking'
                                defaultMessage='Checking...'
                            />
                        </button>
                    ) : (
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
