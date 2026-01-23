// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import styled from 'styled-components';

import type {UserTimezone} from '@mattermost/types/users';

import Moon from 'components/common/svg_images_components/moon_svg';
import Timestamp from 'components/timestamp';

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
    displayName: string;
    timestamp: number;
    teammateTimezone: UserTimezone;
}

const RemoteUserHour = ({displayName, timestamp, teammateTimezone}: Props) => {
    return (
        <Container className='RemoteUserHour'>
            <Icon className='icon moonIcon'/>
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
