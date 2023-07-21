// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';
import React, {memo, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';

import Avatar from 'components/widgets/users/avatar';

import {Constants} from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import './draft_title.scss';

type Props = {
    channelType: Channel['type'];
    channelName: string;
    membersCount?: number;
    selfDraft: boolean;
    teammate?: UserProfile;
    teammateId?: string;
    type: 'channel' | 'thread';
}

function DraftTitle({
    channelType,
    channelName,
    membersCount,
    selfDraft,
    teammate,
    teammateId,
    type,
}: Props) {
    const dispatch = useDispatch();

    useEffect(() => {
        if (!teammate?.id && teammateId) {
            dispatch(getMissingProfilesByIds([teammateId]));
        }
    }, [teammate?.id, teammateId]);

    let you = null;
    let title = null;

    if (selfDraft) {
        you = (
            <>
                &nbsp;
                <FormattedMessage
                    id='drafts.draft_title.you'
                    defaultMessage={'(you)'}
                />
            </>
        );
    }

    let icon = <i className='icon icon-globe'/>;

    if (channelType === Constants.PRIVATE_CHANNEL) {
        icon = <i className='icon icon-lock-outline'/>;
    }

    if (channelType === Constants.DM_CHANNEL && teammate) {
        icon = (
            <Avatar
                size='xs'
                username={teammate.username}
                url={imageURLForUser(teammate.id, teammate.last_picture_update)}
                className='DraftTitle__avatar'
            />
        );
    }

    if (channelType === Constants.GM_CHANNEL) {
        icon = (
            <div className='DraftTitle__group-icon'>
                {membersCount}
            </div>
        );
    }

    if (type === 'thread') {
        if (
            channelType !== Constants.GM_CHANNEL &&
            channelType !== Constants.DM_CHANNEL
        ) {
            title = (
                <FormattedMessage
                    id='drafts.draft_title.channel_thread'
                    defaultMessage={'Thread in: {icon} <span>{channelName}</span>'}
                    values={{
                        icon,
                        channelName,
                        span: (chunks: React.ReactNode) => (<span>{chunks}</span>),
                    }}
                />
            );
        } else {
            title = (
                <FormattedMessage
                    id='drafts.draft_title.direct_thread'
                    defaultMessage={'Thread to: {icon} <span>{channelName}</span>'}
                    values={{
                        icon,
                        channelName,
                        span: (chunks: React.ReactNode) => (<span>{chunks}</span>),
                    }}
                />
            );
        }
    } else if (
        channelType !== Constants.GM_CHANNEL &&
        channelType !== Constants.DM_CHANNEL
    ) {
        title = (
            <FormattedMessage
                id='drafts.draft_title.channel'
                defaultMessage={'In: {icon} <span>{channelName}</span>'}
                values={{
                    icon,
                    channelName,
                    span: (chunks: React.ReactNode) => (<span>{chunks}</span>),
                }}
            />
        );
    } else {
        title = (
            <FormattedMessage
                id='drafts.draft_title.direct_channel'
                defaultMessage={'To: {icon} <span>{channelName}</span>'}
                values={{
                    icon,
                    channelName,
                    span: (chunks: React.ReactNode) => (<span>{chunks}</span>),
                }}
            />
        );
    }

    return (
        <>
            {title}
            {you}
        </>
    );
}

export default memo(DraftTitle);
