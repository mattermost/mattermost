// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {AlertOutlineIcon, AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {PostPriority} from '@mattermost/types/posts';

type Props = {
    priority?: PostPriority;
    className?: string;
}

const Badge = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    width: 20px;
    min-width: 20px;
    margin-right: 10px;
    border-radius: 10px;
    color: #fff;

    background-color: ${(props: {priority: PostPriority}) => {
        return props.priority === PostPriority.URGENT ? 'rgb(var(--semantic-color-danger))' : 'rgb(var(--semantic-color-info))';
    }}
`;

export default function PriorityLabel({priority, className}: Props) {
    if (priority !== PostPriority.URGENT && priority !== PostPriority.IMPORTANT) {
        return null;
    }

    return (
        <Badge
            className={className}
            priority={priority}
        >
            {priority === PostPriority.URGENT ? (
                <AlertOutlineIcon size={14}/>
            ) : (
                <AlertCircleOutlineIcon size={14}/>
            )}
        </Badge>
    );
}
