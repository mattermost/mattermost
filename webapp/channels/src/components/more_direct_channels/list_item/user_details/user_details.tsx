// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getRemoteDisplayName} from 'mattermost-redux/selectors/entities/shared_channels';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import ProfilePicture from 'components/profile_picture';
import SharedUserIndicator from 'components/shared_user_indicator';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {displayEntireNameForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

type Props = {
    currentUserId: string;
    option: UserProfile;
    status: string;
    actions: {
        fetchRemoteClusterInfo: (remoteId: string, forceRefresh?: boolean) => void;
    };
};

export default function UserDetails(props: Props): JSX.Element {
    const {currentUserId, option, status, actions} = props;

    const remoteDisplayName = useSelector((state: GlobalState) => (
        option.remote_id ? getRemoteDisplayName(state, option.remote_id) : null
    ));

    // Fetch remote info when component mounts for remote users
    useEffect(() => {
        if (option.remote_id && (!remoteDisplayName)) {
            actions.fetchRemoteClusterInfo(option.remote_id);
        }
    }, [option.remote_id, remoteDisplayName, actions.fetchRemoteClusterInfo]);

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
                    {option.remote_id && (
                        <SharedUserIndicator
                            withTooltip={true}
                            className='more-modal__shared-icon'
                            remoteNames={remoteDisplayName ? [remoteDisplayName] : undefined}
                        />
                    )}
                    <CustomStatusEmoji
                        userID={option.id}
                        showTooltip={true}
                        emojiSize={15}
                        spanStyle={{
                            display: 'flex',
                            flex: '0 0 auto',
                            alignItems: 'center',
                        }}
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
