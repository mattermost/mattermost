// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

/**
 * This is a styled div that should be used as a container for popovers.
 * It has basic styling common to all popovers containers, however, it can be extended to add more styling.
 */
export const StyledPopoverContainer = styled.div`
    border-radius: 4px;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    background-color: var(--center-channel-bg);
    box-shadow: var(--elevation-4);
    z-index: 9999;
`;
