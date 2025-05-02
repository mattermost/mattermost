// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {OverlayTrigger, Tooltip} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';
import {getFeatureFlagValue} from 'mattermost-redux/selectors/entities/general';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import ProfilePicture from 'components/profile_picture';
import Badge from 'components/widgets/badges/badge';
import InfoIcon from 'components/widgets/icons/info_icon';
import BotTag from 'components/widgets/tag/bot_tag';
import GuestTag from 'components/widgets/tag/guest_tag';

import {displayEntireNameForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

type Props = {
    currentUserId: string;
    option: UserProfile;
    status: string;

    // For testing
    enableSharedChannelsDMs?: boolean;
};

export default function UserDetails(props: Props): JSX.Element {
    const {currentUserId, option, status, enableSharedChannelsDMs: propEnableSharedChannelsDMs} = props;
    const {
        id,
        delete_at: deleteAt,
        is_bot: isBot = false,
        last_picture_update: lastPictureUpdate,
        remote_id: remoteId,
    } = option;

    // Get the feature flag value to determine if remote user messaging is enabled
    // Allow prop override for testing
    const featureFlagValue = useSelector((state: GlobalState) => getFeatureFlagValue(state, 'EnableSharedChannelsDMs') === 'true');
    const enableSharedChannelsDMs = propEnableSharedChannelsDMs ?? featureFlagValue;

    const isRemoteUser = Boolean(remoteId);

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

    // The remote user tooltip message depends on whether the feature flag is enabled

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
                    {isRemoteUser && (
                        <Badge
                            className='remote-user-badge'
                            variant='info'
                        >
                            {'Remote'}
                        </Badge>
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
                        {isRemoteUser && !enableSharedChannelsDMs && (
                            <OverlayTrigger
                                delayShow={500}
                                placement='top'
                                overlay={
                                    <Tooltip id={`tooltip-remote-${id}`}>
                                        {'Messaging with remote users will be available soon'}
                                    </Tooltip>
                                }
                            >
                                <span
                                    className='remote-coming-soon'
                                    style={{marginLeft: '4px'}}
                                >
                                    <InfoIcon size={14}/>
                                </span>
                            </OverlayTrigger>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
