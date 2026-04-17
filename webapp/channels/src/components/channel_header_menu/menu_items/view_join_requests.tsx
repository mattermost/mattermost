// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {Client4} from 'mattermost-redux/client';

import {openModal} from 'actions/views/modals';

import ChannelJoinRequestsModal from 'components/channel_join_requests_modal/channel_join_requests_modal';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
};

const MenuItemViewJoinRequests = ({channel}: Props) => {
    const dispatch = useDispatch();
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (channel.discoverable && channel.type === 'P') {
            Client4.getPendingJoinRequestCount(channel.id).then((result) => {
                setPendingCount(result.count);
            }).catch(() => {
                setPendingCount(0);
            });
        }
    }, [channel.id, channel.discoverable, channel.type]);

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CHANNEL_JOIN_REQUESTS,
            dialogType: ChannelJoinRequestsModal,
            dialogProps: {
                channelId: channel.id,
                channelDisplayName: channel.display_name,
            },
        }));
    }, [dispatch, channel.id, channel.display_name]);

    if (!channel.discoverable || channel.type !== 'P') {
        return null;
    }

    const badge = pendingCount > 0 ? (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 10,
                backgroundColor: 'var(--button-bg)',
                color: 'var(--button-color)',
                fontSize: 11,
                fontWeight: 700,
            }}
        >
            {pendingCount}
        </span>
    ) : undefined;

    return (
        <Menu.Item
            id='channelViewJoinRequests'
            onClick={handleClick}
            labels={(
                <FormattedMessage
                    id='channel_header.viewJoinRequests'
                    defaultMessage='Join Requests'
                />
            )}
            trailingElements={badge}
        />
    );
};

export default MenuItemViewJoinRequests;
