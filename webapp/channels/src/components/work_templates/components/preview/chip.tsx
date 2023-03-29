// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

const Chip = styled.span`
    padding: 0px 4px;
    width: 20px;
    height: 16px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 11px;
    line-height: 16px;
    letter-spacing: 0.02em;

    background: rgba(var(--center-channel-text-rgb), 0.08);
    color: rgba(var(--center-channel-text-rgb), 0.56);
`;

export default Chip;
