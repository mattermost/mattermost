// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';
import styled from 'styled-components';

import glyphMap, {AlertOutlineIcon, AlertCircleOutlineIcon} from '@mattermost/compass-icons/components';
import type {PostPriorityValue} from '@mattermost/types/posts';
import {PostPriority} from '@mattermost/types/posts';

import {getPostPriorityLabels} from 'mattermost-redux/selectors/entities/posts';

type Props = {
    priority?: PostPriorityValue;
    className?: string;
}

const Badge = styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 20px;
    width: 20px;
    margin-left: 8px;
    min-width: 20px;
    border-radius: 10px;
    color: #fff;

    background-color: ${(props: {variant?: string}) => {
        switch (props.variant) {
        case 'danger':
            return 'rgb(var(--semantic-color-danger))';
        case 'success':
            return 'rgb(var(--semantic-color-success))';
        case 'warning':
            return 'rgb(var(--semantic-color-warning))';
        case 'info':
            return 'rgb(var(--semantic-color-info))';
        default:
            return 'rgb(var(--semantic-color-general))';
        }
    }}
`;

export default function PriorityLabel({priority, className}: Props) {
    const postPriorityLabels = useSelector(getPostPriorityLabels);

    if (!priority) {
        return null;
    }

    const label = postPriorityLabels.find((item) => item.id === priority);
    if (!label) {
        return null;
    }

    const Icon = label.icon ? glyphMap[label.icon as keyof typeof glyphMap] : undefined;

    return (
        <Badge
            className={className}
            variant={label.variant}
        >
            {(() => {
                if (Icon) {
                    return <Icon size={14}/>;
                }

                if (priority === PostPriority.URGENT) {
                    return <AlertOutlineIcon size={14}/>;
                }

                return <AlertCircleOutlineIcon size={14}/>;
            })()}
        </Badge>
    );
}
