// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

interface Props {
    label: string;
    onClick?: () => void;
    'data-testid'?: string;
}

const PropertyChip = (props: Props) => {
    return (
        <ChipContainer
            onClick={props.onClick}
            data-testid={props['data-testid']}
        >
            {props.label}
        </ChipContainer>
    );
};

const ChipContainer = styled.div`
    display: inline-block;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    border-radius: 12px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    color: var(--center-channel-color);
    margin-right: 4px;
    margin-bottom: 2px;
    cursor: ${(props) => (props.onClick ? 'pointer' : 'default')};

    &:hover {
        ${(props) => props.onClick && `
            background: rgba(var(--center-channel-color-rgb), 0.16);
        `}
    }
`;

export default PropertyChip;
