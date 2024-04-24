// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {SendIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import AddToChannel from './add_to_channel';
import CallButton from './call_button';

type Props = {
    user: UserProfile;
    fullname: string;
    channelId?: string;
    currentUserId: string;
    haveOverrideProp: boolean;
    handleShowDirectChannel: (e: React.MouseEvent<HTMLButtonElement>) => void;
    returnFocus: () => void;
    handleCloseModals: () => void;
    hide?: () => void;
};

const ProfilePopoverActions = ({
    currentUserId,
    haveOverrideProp,
    user,
    handleShowDirectChannel,
    handleCloseModals,
    returnFocus,
    hide,
    fullname,
    channelId,
}: Props) => {
    const {formatMessage} = useIntl();

    if (user.id === currentUserId || haveOverrideProp) {
        return null;
    }
    return (
        <div
            data-toggle='tooltip'
            className='popover__row first'
        >
            <button
                id='messageButton'
                type='button'
                className='btn'
                onClick={handleShowDirectChannel}
            >
                <SendIcon
                    size={16}
                    aria-label={formatMessage({
                        id: 'user_profile.send.dm.icon',
                        defaultMessage: 'Send Message Icon',
                    })}
                />
                <FormattedMessage
                    id='user_profile.send.dm'
                    defaultMessage='Message'
                />
            </button>
            <div className='popover_row-controlContainer'>
                <AddToChannel
                    handleCloseModals={handleCloseModals}
                    returnFocus={returnFocus}
                    user={user}
                    hide={hide}
                />
                <CallButton
                    channelId={channelId}
                    currentUserId={currentUserId}
                    fullname={fullname}
                    userId={user.id}
                    username={user.username}
                />
            </div>
        </div>
    );
};

export default ProfilePopoverActions;
