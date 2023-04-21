// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

interface Props {
    children: React.ReactNode;
}
export default function Badge(props: Props) {
    return (
        <StyledBadge>
            {props.children}
        </StyledBadge>
    );
}
const StyledBadge = styled.span`
    align-items: center;
    justify-content: center;
    padding: 4px 5px;
    border-radius: 4px;
    font-size: 10px;
    line-height: 16px;
    font-weight: 600;
    text-transform: uppercase;
    background-color: var(--online-indicator);
    color: var(--center-channel-bg);
`;
