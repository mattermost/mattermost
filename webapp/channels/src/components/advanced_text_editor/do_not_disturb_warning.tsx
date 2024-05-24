// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getCurrentUserId, getStatusForUserId, makeGetDisplayName} from 'mattermost-redux/selectors/entities/users';

import {UserStatuses} from 'utils/constants';

import type {GlobalState} from 'types/store';

const getDisplayName = makeGetDisplayName();

const Container = styled.div`
    padding: 8px 24px;
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.75);

    & + .AdvancedTextEditor {
        padding-top: 0;
    }
`;

const Icon = styled.i`
    color: #d24b4e;
    font-size: 14px;
    margin-right: 2px;
`;

type Props = {
    channelId: string;
}

const DoNotDisturbWarning = ({channelId}: Props) => {
    const userId = useSelector(getCurrentUserId);
    const channel = useSelector((state: GlobalState) => getChannel(state, channelId));
    const channelMembersIds = channel?.name.split('__');

    let teammateId = '';
    if (channelMembersIds && channelMembersIds.length === 2) {
        teammateId = channelMembersIds[0];
        if (teammateId === userId) {
            teammateId = channelMembersIds[1];
        }
    }

    const status = useSelector((state: GlobalState) => getStatusForUserId(state, teammateId));
    const displayName = useSelector((state: GlobalState) => getDisplayName(state, teammateId, true));

    if (teammateId === userId) {
        return null;
    }

    if (!channel || channel.type !== 'D') {
        return null;
    }

    if (status !== UserStatuses.DND) {
        return null;
    }

    return (
        <Container className='DoNotDisturbWarning'>
            <Icon className='icon-minus-circle'/>
            <FormattedMessage
                id='advanced_create_post.doNotDisturbWarning'
                defaultMessage='{displayName} is set to <b>Do Not Disturb.</b>'
                values={{displayName, b: (chunks: any) => <b>{chunks}</b>}}
            />
        </Container>
    );
};

export default DoNotDisturbWarning;
