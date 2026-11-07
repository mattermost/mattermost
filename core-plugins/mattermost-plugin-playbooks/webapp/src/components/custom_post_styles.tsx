// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

export const CustomPostContainer = styled.div`
    display: flex;
    max-width: 640px;
    flex-direction: row;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    box-shadow: 0 2px 3px rgba(0 0 0 / 0.08);
`;

export const CustomPostContent = styled.div`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    padding: 12px;
    padding-left: 16px;
`;

export const CustomPostHeader = styled.div`
    font-size: 16px;
    font-weight: 600;
    line-height: 24px;
`;

export const CustomPostButtonRow = styled.div`
    display: flex;
    flex-direction: row;
    padding-top: 12px;
`;
