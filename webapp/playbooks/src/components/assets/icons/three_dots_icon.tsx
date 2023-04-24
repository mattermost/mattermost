// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

const ThreeDotsIcon = (props: React.PropsWithoutRef<JSX.IntrinsicElements['i']>): JSX.Element => (
    <i
        className={`icon icon-dots-vertical ${props.className}`}
    />
);

export const HamburgerButton = styled(ThreeDotsIcon)`
    font-size: 24px;
    position: relative;
`;
