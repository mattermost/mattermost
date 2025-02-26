// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {batchGetProfilesInChannel, getMissingProfilesByIds} from 'mattermost-redux/actions/users';

import Avatar from 'components/widgets/users/avatar';

import {Constants} from 'utils/constants';
import {imageURLForUser} from 'utils/utils';

import './draft_title.scss';

type Props = {
    channel: Channel;
    membersCount?: number;
    selfDraft: boolean;
    teammate?: UserProfile;
    teammateId?: string;
    type: 'channel' | 'thread';
}

function DraftTitle({
    channel,
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

    useEffect(() => {
        // if you have a scheduled post in a GM and you closed that GM,
        // we don't fetch that GM's members by default. This causes the number of GM members
        // in scheduled posts row header to show up as '0'. To fix this,
        // we check if the channel is a GM and member count is 0 (could will at least be 1 as the current user
        // is always a member) and if so, fetch the GM members.
        // The action uses a data loader so it is safe to call do this for multiple
        // scheduled posts for the same GM without causing any duplicate API calls.
        if (channel.type === Constants.GM_CHANNEL && !membersCount) {
            dispatch(batchGetProfilesInChannel(channel.id));
        }
    }, [channel.id, channel.type, dispatch, membersCount]);

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

    if (channel.type === Constants.PRIVATE_CHANNEL) {
        icon = <i className='icon icon-lock-outline'/>;
    }

    if (channel.type === Constants.DM_CHANNEL && teammate) {
        icon = (
            <Avatar
                size='xs'
                username={teammate.username}
                url={imageURLForUser(teammate.id, teammate.last_picture_update)}
                className='DraftTitle__avatar'
            />
        );
    }

    if (channel.type === Constants.GM_CHANNEL) {
        icon = (
            <div className='DraftTitle__group-icon'>
                {membersCount}
            </div>
        );
    }

    if (type === 'thread') {
        if (
            channel.type !== Constants.GM_CHANNEL &&
            channel.type !== Constants.DM_CHANNEL
        ) {
            title = (
                <FormattedMessage
                    id='drafts.draft_title.channel_thread'
                    defaultMessage={'Thread in: {icon} <span>{channelName}</span>'}
                    values={{
                        icon,
                        channelName: channel.display_name,
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
                        channelName: channel.display_name,
                        span: (chunks: React.ReactNode) => (<span>{chunks}</span>),
                    }}
                />
            );
        }
    } else if (
        channel.type !== Constants.GM_CHANNEL &&
        channel.type !== Constants.DM_CHANNEL
    ) {
        title = (
            <FormattedMessage
                id='drafts.draft_title.channel'
                defaultMessage={'In: {icon} <span>{channelName}</span>'}
                values={{
                    icon,
                    channelName: channel.display_name,
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
                    channelName: channel.display_name,
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
