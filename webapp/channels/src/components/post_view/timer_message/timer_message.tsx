// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, { useEffect, useState } from 'react';

import type { Post } from '@mattermost/types/posts';

import './timer_message.scss';

type Props = {
    post: Post;
    isRHS?: boolean;
};

export const TimerMessage = ({ post, isRHS }: Props) => {
    const targetTimestamp = post.props?.timer_target as number | undefined;
    const [timeLeft, setTimeLeft] = useState<number>(() => {
        if (!targetTimestamp) {
            return 0;
        }
        return Math.max(0, targetTimestamp - Date.now());
    });

    useEffect(() => {
        if (!targetTimestamp) {
            return undefined;
        }

        const updateTimer = () => {
            setTimeLeft(Math.max(0, targetTimestamp - Date.now()));
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [targetTimestamp]);

    if (!targetTimestamp || post.delete_at > 0) {
        return null;
    }

    const totalSeconds = Math.floor(timeLeft / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let timeString = '';
    if (hours > 0) {
        timeString += `${hours.toString().padStart(2, '0')}:`;
    }
    timeString += `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    const isExpired = timeLeft === 0;

    return (
        <div className={`TimerMessage ${isExpired ? 'expired' : ''} ${isRHS ? 'rhs' : ''}`}>
            <span className='countdown'>{isExpired ? '00:00' : timeString}</span>
        </div>
    );
};
