// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {FormattedMessage} from 'react-intl';

const EmptyState = () => {
    return (
        <EmptyText>
            <FormattedMessage defaultMessage='Empty'/>
        </EmptyText>
    );
};

const EmptyText = styled.span`
    color: var(--center-channel-color-64);
    font-style: italic;
    font-size: 14px;
    line-height: 20px;
`;

export default EmptyState;