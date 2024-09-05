// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import Timestamp, {RelativeRanges} from 'components/timestamp';

import {getDisplayName, getUserIdFromChannelName} from 'utils/utils';

import type {GlobalState} from 'types/store';

import './dmUserTimezone.scss';

type Props = {
    selectedTime?: Date;
}

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

export function DMUserTimezone({selectedTime}: Props) {
    const currentChannel = useSelector(getCurrentChannel);
    const dmUserId = currentChannel && currentChannel.type === 'D' ? getUserIdFromChannelName(currentChannel) : '';
    const dmUser = useSelector((state: GlobalState) => getUser(state, dmUserId));

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

    if (!currentChannel || currentChannel.type !== 'D') {
        return null;
    }

    return (
        <div className='DMUserTimezone'>
            <FormattedMessage
                id='schedule_post.custom_time_modal.dm_user_time'
                defaultMessage='{dmUserTime} for {dmUserName}'
                values={{
                    dmUserTime,
                    dmUserName: getDisplayName(dmUser),
                }}
            />
        </div>
    );
}
