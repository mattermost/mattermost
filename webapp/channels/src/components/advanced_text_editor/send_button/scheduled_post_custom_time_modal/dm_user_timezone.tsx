// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {General} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import Timestamp, {RelativeRanges} from 'components/timestamp';

import {getDisplayNameByUser, getUserIdFromChannelName} from 'utils/utils';

import type {GlobalState} from 'types/store';

import './dm_user_timezone.scss';

type Props = {
    channelId: string;
    selectedTime?: Date;

    // When the time is picked in the DM recipient's timezone, show it in the current user's timezone instead.
    showCurrentUserTime?: boolean;
};

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

const USE_TIME_HOUR_MINUTE = {
    hour: 'numeric',
    minute: 'numeric',
} as const;

export function DMUserTimezone({channelId, selectedTime, showCurrentUserTime = false}: Props) {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const currentUserId = useSelector(getCurrentUserId);
    const dmUserId = channel && channel.type === General.DM_CHANNEL ? getUserIdFromChannelName(channel) : '';
    const dmUser = useSelector((state: GlobalState) => getUser(state, dmUserId));
    const dmUserName = useSelector((state: GlobalState) => getDisplayNameByUser(state, dmUser));

    if (!channel || channel.type !== General.DM_CHANNEL || !dmUser || dmUser.is_bot || dmUser.id === currentUserId) {
        return null;
    }

    if (showCurrentUserTime) {
        return (
            <div className='DMUserTimezone'>
                <FormattedMessage
                    id='schedule_post.custom_time_modal.current_user_time'
                    defaultMessage='{time} your time'
                    values={{
                        time: (
                            <Timestamp
                                ranges={DATE_RANGES}
                                useTime={USE_TIME_HOUR_MINUTE}
                                value={selectedTime}
                            />
                        ),
                    }}
                />
            </div>
        );
    }

    return (
        <div className='DMUserTimezone'>
            <FormattedMessage
                id='schedule_post.custom_time_modal.dm_user_time_label'
                defaultMessage='{dmUserTime} {dmUserName}’s time'
                values={{
                    dmUserTime: (
                        <Timestamp
                            ranges={DATE_RANGES}
                            userTimezone={dmUser.timezone}
                            useTime={USE_TIME_HOUR_MINUTE}
                            value={selectedTime}
                        />
                    ),
                    dmUserName,
                }}
            />
        </div>
    );
}
