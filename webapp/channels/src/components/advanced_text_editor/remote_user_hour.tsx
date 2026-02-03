// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import type {UserTimezone} from '@mattermost/types/users';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import Moon from 'components/common/svg_images_components/moon_svg';
import Timestamp from 'components/timestamp';

import type {GlobalState} from 'types/store';

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

const Icon = styled(Moon)<{$matchTextSize?: boolean}>`
    svg {
        width: ${(props) => (props.$matchTextSize ? '12px' : '16px')};
        height: ${(props) => (props.$matchTextSize ? '12px' : '16px')};
    }
    svg path {
        fill: rgba(var(--center-channel-color-rgb), 0.75);
    }
    margin: 0 2px;
`;

type Props = {
    displayName: string;
    timestamp: number;
    teammateTimezone: UserTimezone;
}

const RemoteUserHour = ({displayName, timestamp, teammateTimezone}: Props) => {
    const config = useSelector((state: GlobalState) => getConfig(state));
    const matchIconSize = config.MattermostExtendedMediaMatchRemoteUserHourIconSize === 'true';
    return (
        <Container className='RemoteUserHour'>
            <Icon
                className='icon moonIcon'
                $matchTextSize={matchIconSize}
            />
            <FormattedMessage
                id='advanced_text_editor.remote_user_hour'
                defaultMessage='The time for {user} is {time}'
                values={{
                    user: (
                        <span className='userDisplayName'>
                            {displayName}
                        </span>
                    ),
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
