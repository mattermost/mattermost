// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    size?: number;
    className?: string;
};

const DiscordThreadIcon = ({size = 18, className = ''}: Props) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox='0 0 16 16'
            fill='none'
            className={className}
        >
            {/* Top line */}
            <path
                d='M5 4h9'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
            />
            {/* Chevron */}
            <path
                d='M2 6l3 2-3 2'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            />
            {/* Middle line (shorter on left) */}
            <path
                d='M8 8h6'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
            />
            {/* Bottom line */}
            <path
                d='M5 12h9'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
            />
        </svg>
    );
};

export default DiscordThreadIcon;
