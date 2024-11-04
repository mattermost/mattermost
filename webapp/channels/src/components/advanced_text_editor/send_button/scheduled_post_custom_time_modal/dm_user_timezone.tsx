// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {General} from 'mattermost-redux/constants';
import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import Timestamp, {RelativeRanges} from 'components/timestamp';

import {getDisplayNameByUser, getUserIdFromChannelName} from 'utils/utils';

import type {GlobalState} from 'types/store';

import './dm_user_timezone.scss';

type Props = {
    channelId: string;
    selectedTime?: Date;
}

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

export function DMUserTimezone({channelId, selectedTime}: Props) {
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const dmUserId = channel && channel.type === General.DM_CHANNEL ? getUserIdFromChannelName(channel) : '';
    const dmUser = useSelector((state: GlobalState) => getUser(state, dmUserId));
    const dmUserName = useSelector((state: GlobalState) => getDisplayNameByUser(state, dmUser));

    const dmUserTime = useMemo(() => {
        if (!dmUser) {
            return null;
        }

        return (
            <Timestamp
                ranges={DATE_RANGES}
                userTimezone={dmUser.timezone}
                useTime={{
                    hour: 'numeric',
                    minute: 'numeric',
                }}
                value={selectedTime}
            />
        );
    }, [dmUser, selectedTime]);

    if (!channel || channel.type !== 'D') {
        return null;
    }

    return (
        <div className='DMUserTimezone'>
            <FormattedMessage
                id='schedule_post.custom_time_modal.dm_user_time'
                defaultMessage='{dmUserTime} for {dmUserName}'
                values={{
                    dmUserTime,
                    dmUserName,
                }}
            />
        </div>
    );
}
