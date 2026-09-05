// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import styled, {css} from 'styled-components';

import {FormattedMessage} from 'react-intl';

export enum BadgeType {
    InProgress = 'InProgress',
    Finished = 'Finished',
    Archived = 'Archived',
}

interface BadgeProps {
    $status: BadgeType;
    $compact?: boolean;
}

const Badge = styled.div<BadgeProps>`
    position: relative;
    display: inline-block;
    font-size: 12px;
    border-radius: 4px;
    padding: 0 8px;
    font-weight: 600;
    margin: 2px;
    color: var(--button-color);
    ${(props) => {
        switch (props.$status) {
        case BadgeType.InProgress:
            return css`
                background-color: var(--sidebar-text-active-border);
            `;
        case BadgeType.Finished:
            return css`
                background-color: rgba(var(--center-channel-color-rgb), 0.64);
            `;
        case BadgeType.Archived:
            return css`
                background-color: rgba(var(--center-channel-color-rgb), 0.32);
            `;
        default:
            return css`
                box-shadow: gray 0 0 2pt;
                color: var(--center-channel-color);
            `;
        }
    }}
    top: 1px;
    height: 24px;
    line-height: 24px;

    ${(props) => props.$compact && css`
        height: 20px;
        line-height: 20px;
    `}
`;

interface StatusBadgeProps {
    status: BadgeType;
    compact?: boolean;
}

const StatusBadge = (props: StatusBadgeProps) => {
    let message;
    switch (props.status) {
    case BadgeType.InProgress:
        message = <FormattedMessage defaultMessage='In Progress'/>;
        break;
    case BadgeType.Finished:
        message = <FormattedMessage defaultMessage='Finished'/>;
        break;
    case BadgeType.Archived:
        message = <FormattedMessage defaultMessage='Archived'/>;
        break;
    }

    return (
        <Badge
            data-testid={'badge'}
            $status={props.status}
            $compact={props.compact}
        >
            {message}
        </Badge>
    );
};

export default StatusBadge;
