// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import type {GlobalState} from '@mattermost/types/store';

import {getTimezoneForUserProfile} from 'mattermost-redux/selectors/entities/timezone';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import Moon from 'components/common/svg_images_components/moon_svg';
import Timestamp from 'components/timestamp';

import Constants from 'utils/constants';

const Container = styled.div`
    display: flex;
    aling-items: center;
    padding: 8px 24px;
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.75);

    & + .AdvancedTextEditor {
        padding-top: 0;
    }

    time {
        font-weight: 600;
    }
`;

const Icon = styled(Moon)`
    svg {
        width: 16px;
        height: 16px;
    }
    svg path {
        fill: rgba(var(--center-channel-color-rgb), 0.75);
    }
    margin: 0 2px;
`;

type Props = {
    teammateId: string;
    displayName: string;
}

const DEFAULT_TIMEZONE = {
    useAutomaticTimezone: true,
    automaticTimezone: '',
    manualTimezone: '',
};

const RemoteUserHour = ({teammateId, displayName}: Props) => {
    const [timestamp, setTimestamp] = useState(0);
    const [showIt, setShowIt] = useState(false);

    const teammateTimezone = useSelector((state: GlobalState) => {
        const teammate = teammateId ? getUser(state, teammateId) : undefined;
        return teammate ? getTimezoneForUserProfile(teammate) : DEFAULT_TIMEZONE;
    }, (a, b) => a.automaticTimezone === b.automaticTimezone &&
        a.manualTimezone === b.manualTimezone &&
        a.useAutomaticTimezone === b.useAutomaticTimezone);

    useEffect(() => {
        const teammateUserDate = DateTime.local().setZone(teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone);
        setTimestamp(teammateUserDate.toMillis());
        setShowIt(teammateUserDate.get('hour') >= Constants.REMOTE_USERS_HOUR_LIMIT_END_OF_THE_DAY || teammateUserDate.get('hour') < Constants.REMOTE_USERS_HOUR_LIMIT_BEGINNING_OF_THE_DAY);

        const interval = setInterval(() => {
            const teammateUserDate = DateTime.local().setZone(teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone);
            setTimestamp(teammateUserDate.toMillis());
            setShowIt(teammateUserDate.get('hour') >= Constants.REMOTE_USERS_HOUR_LIMIT_END_OF_THE_DAY || teammateUserDate.get('hour') < Constants.REMOTE_USERS_HOUR_LIMIT_BEGINNING_OF_THE_DAY);
        }, 1000 * 60);
        return () => clearInterval(interval);
    }, [teammateTimezone.useAutomaticTimezone, teammateTimezone.automaticTimezone, teammateTimezone.manualTimezone]);

    if (!showIt) {
        return null;
    }

    if (timestamp === 0) {
        return null;
    }

    return (
        <Container>
            <Icon/>
            <FormattedMessage
                id='advanced_text_editor.remote_user_hour'
                defaultMessage='The time for {user} is {time}'
                values={{
                    user: displayName,
                    time: (
                        <Timestamp
                            useRelative={false}
                            value={timestamp}
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
