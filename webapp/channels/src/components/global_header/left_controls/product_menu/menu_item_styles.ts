// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled, {css} from 'styled-components';

// Shared row style for product-switcher menu entries. Both the link-based ProductMenuItem and the
// button-based ProductSwitcherMenuItem use this so the shared dimensions, hover, and text styles
// live in one place instead of being redeclared per component. ProductMenuItemText is the shared
// label span used by both rows.
export const productMenuRowStyle = css`
    height: 40px;
    width: 270px;
    padding-left: 16px;
    padding-right: 20px;
    display: flex;
    align-items: center;
    cursor: pointer;
    position: relative;
    text-decoration: none;
    color: inherit;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        text-decoration: none;
        color: inherit;
    }
`;

export const ProductMenuItemText = styled.span`
    margin-left: 8px;
    flex-grow: 1;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
`;
