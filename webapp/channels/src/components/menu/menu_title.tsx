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

    /** The testid of a title that is a separator (`role="separator"`): it renders `<separatorTestId>--separator`. */
    separatorTestId?: string;

    /** The scope of any other title: it renders `<testId>--text`, or `<testId>:<testKey>--text` with a `testKey`. */
    testId?: string;
    testKey?: string;
}

export function MenuTitle(props: Props) {
    const {
        children,
        role,
        separatorTestId,
        testId,
        testKey,
    } = props;

    let titleTestId;
    if (separatorTestId) {
        titleTestId = `${separatorTestId}--separator`;
    } else if (testId) {
        titleTestId = `${testId}${testKey ? `:${testKey}` : ''}--text`;
    }

    return (
        <Title
            role={role}
            data-testid={titleTestId}
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
