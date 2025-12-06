// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './inline_comment_context.scss';

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
        <div className='inline-comment-anchor-box'>
            <div className='inline-comment-anchor-text'>
                {anchorText || 'TEST TEXT'}
            </div>
        </div>
    );
};

export default InlineCommentContext;
