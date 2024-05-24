// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTimezoneForUserProfile} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId, getUser, makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import Timestamp from 'components/timestamp';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

const getDisplayName = makeGetDisplayName();

const Container = styled.div`
    padding: 8px 24px;
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.75);

    .DoNotDisturbWarning + &{
        display: none;
    }
`;

const Icon = styled.i`
    font-size: 14px;
    margin-right: 2px;
`;

type Props = {
    channelId: string;
}

const RemoteUserHour = ({channelId}: Props) => {
    const userId = useSelector(getCurrentUserId);
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId))
    const channelMembersIds = channel?.name.split('__');

    let teammateId = '';
    if (channelMembersIds && channelMembersIds.length === 2) {
        teammateId = channelMembersIds[0];
        if (teammateId === userId) {
            teammateId = channelMembersIds[1];
        }
    }

    const displayName = useSelector((state: GlobalState) => getDisplayName(state, teammateId, true));
    const teammate = useSelector((state: GlobalState) => getUser(state, teammateId));

    if (teammateId === userId) {
        return null;
    }

    const teammateTimezone = getTimezoneForUserProfile(teammate);
    const teammateUserDate = DateTime.local().setZone(teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone);

    const showIt = teammateUserDate.get('hour') >= Constants.REMOTE_USERS_HOUR_LIMIT_END_OF_THE_DAY || teammateUserDate.get('hour') <= Constants.REMOTE_USERS_HOUR_LIMIT_BEGINNING_OF_THE_DAY;

    if (!showIt) {
        return null;
    }

    if (!channel || channel.type !== 'D') {
        return null;
    }

    return (
        <Container>
            <Icon className='icon-clock-outline'/>
            <FormattedMessage
                id='advanced_text_editor.remote_user_hour'
                defaultMessage='The time for {user} is: {time}'
                values={{
                    user: displayName,
                    time: (
                        <Timestamp
                            updateIntervalInSeconds={30}
                            useRelative={false}
                            useDate={false}
                            userTimezone={teammateTimezone}
                            useTime={{
                                hour: 'numeric',
                                minute: 'numeric',
                            }}
                        />
                    ),
                }}
            />
        </Container>
    );
};

export default RemoteUserHour;
