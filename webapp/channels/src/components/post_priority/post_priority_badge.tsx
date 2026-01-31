// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {AlertOutlineIcon, AlertCircleOutlineIcon, LockOutlineIcon} from '@mattermost/compass-icons/components';
import {PostPriority} from '@mattermost/types/posts';

type Props = {
    priority?: PostPriority;
    className?: string;
}

const Badge = styled.span<{$priority: PostPriority}>`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    width: 20px;
    margin-left: 8px;
    min-width: 20px;
    border-radius: 10px;
    color: #fff;

    background-color: ${({$priority}) => {
        if ($priority === PostPriority.URGENT) {
            return 'rgb(var(--semantic-color-danger))';
        }
        if ($priority === PostPriority.ENCRYPTED) {
            return 'rgb(147, 51, 234)';
        }
        return 'rgb(var(--semantic-color-info))';
    }}
`;

export default function PriorityLabel({priority, className}: Props) {
    if (priority !== PostPriority.URGENT && priority !== PostPriority.IMPORTANT && priority !== PostPriority.ENCRYPTED) {
        return null;
    }

    let icon;
    if (priority === PostPriority.URGENT) {
        icon = <AlertOutlineIcon size={14}/>;
    } else if (priority === PostPriority.ENCRYPTED) {
        icon = <LockOutlineIcon size={14}/>;
    } else {
        icon = <AlertCircleOutlineIcon size={14}/>;
    }

    return (
        <Badge
            className={className}
            $priority={priority}
        >
            {icon}
        </Badge>
    );
}
