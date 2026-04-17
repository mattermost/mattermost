// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';

import type {Channel} from '@mattermost/types/channels';

import {Client4} from 'mattermost-redux/client';

type Props = {
    channel: Channel;
};

export default function JoinRequestBadge({channel}: Props) {
    const [count, setCount] = useState(0);

    const fetchCount = useCallback(() => {
        if (channel.type !== 'P' || !channel.discoverable) {
            setCount(0);
            return;
        }

        Client4.getPendingJoinRequestCount(channel.id).then((result) => {
            setCount(result?.count || 0);
        }).catch(() => setCount(0));
    }, [channel.id, channel.type, channel.discoverable]);

    useEffect(() => {
        fetchCount();
    }, [fetchCount]);

    useEffect(() => {
        const handler = () => fetchCount();
        window.addEventListener('channel_join_request_change', handler);
        return () => window.removeEventListener('channel_join_request_change', handler);
    }, [fetchCount]);

    if (count === 0) {
        return null;
    }

    return (
        <span
            className='channel-header__join-request-badge'
            style={{
                position: 'absolute',
                top: 2,
                right: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 16,
                height: 16,
                padding: '0 4px',
                borderRadius: 8,
                backgroundColor: 'var(--dnd-indicator)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: '16px',
                pointerEvents: 'none',
            }}
        >
            {count}
        </span>
    );
}
