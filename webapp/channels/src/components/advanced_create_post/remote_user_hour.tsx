// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getCurrentChannel, getMembersInCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTimezoneForUserProfile} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId, getUser, makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import Timestamp from 'components/timestamp';

import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

const getDisplayName = makeGetDisplayName();

const Container = styled.div`
    padding: 8px 24px;
    color: rgba(var(--center-channel-color-rgb), 0.64);

    .DoNotDisturbWarning + &{
        display: none;
    }
`;

const Icon = styled.i`
    font-size: 12px;
    margin-right: 4px;
`;

const RemoteUserHour = () => {
    const userId = useSelector(getCurrentUserId);
    const channel = useSelector(getCurrentChannel);
    const channelMembers = Object.values(useSelector(getMembersInCurrentChannel) || []);

    let teammateId = '';
    if (channelMembers.length === 1) {
        teammateId = channelMembers[0].user_id;
    } else if (channelMembers && channelMembers.length === 2) {
        teammateId = channelMembers[0].user_id;
        if (teammateId === userId) {
            teammateId = channelMembers[1].user_id;
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
            <Icon className='icon-clock'/>
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
                                second: 'numeric',
                            }}
                        />
                    ),
                }}
            />
        </Container>
    );
};

export default RemoteUserHour;
