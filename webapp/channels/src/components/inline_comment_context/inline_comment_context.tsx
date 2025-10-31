// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

type Props = {
    anchorText: string;
    variant?: 'compact' | 'banner';
};

const InlineCommentContext = ({anchorText, variant = 'compact'}: Props) => {
    if (variant === 'banner') {
        return (
            <div
                style={{
                    padding: '12px 20px',
                    backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.04)',
                    borderBottom: '1px solid rgba(var(--center-channel-color-rgb), 0.08)',
                    fontSize: '13px',
                    color: 'rgba(var(--center-channel-color-rgb), 0.72)',
                }}
            >
                <i
                    className='icon icon-message-text-outline'
                    style={{marginRight: '6px'}}
                />
                {'Comments on: '}
                <span
                    style={{
                        fontStyle: 'italic',
                        fontWeight: 600,
                    }}
                >
                    {'"'}
                    {anchorText}
                    {'"'}
                </span>
            </div>
        );
    }

    return (
        <div
            style={{
                fontSize: '12px',
                color: 'rgba(var(--center-channel-color-rgb), 0.64)',
                marginTop: '4px',
            }}
        >
            {'On: "'}
            <span style={{fontStyle: 'italic'}}>{anchorText}</span>
            {'"'}
        </div>
    );
};

export default InlineCommentContext;
