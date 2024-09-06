// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import './style.scss';

type Props = {
    text: string | React.ReactNode;
    className?: string;
}

export default function Badge({text, className}: Props) {
    return (
        <div className={`badge pillBadge ${className || ''}`}>
            {text}
        </div>
    );
}
