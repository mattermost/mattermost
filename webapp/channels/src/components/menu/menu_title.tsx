// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {
    ReactNode,
} from 'react';
import React from 'react';
import styled from 'styled-components';

export interface Props {
    children: ReactNode;
    role?: string;

    /** The title's testid path: it renders `<testId>--separator` with `role="separator"`, else `<testId>`. */
    testId?: string;
}

export function MenuTitle(props: Props) {
    const {
        children,
        role,
        testId,
    } = props;

    return (
        <Title
            role={role}
            data-testid={testId && role === 'separator' ? `${testId}--separator` : testId}
        >
            {children}
        </Title>
    );
}

const Title = styled.h4`
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    text-transform: uppercase;
    padding: 6px 20px;
    margin: 0;
`;
