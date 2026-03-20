// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

export const AutomationHeader = styled.div`
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
`;

export const AutomationTitle = styled.div`
    display: flex;
    width: 350px;
    flex-direction: row;
    align-items: center;
    column-gap: 12px;
`;

export const AutomationLabel = styled.label<{disabled?: boolean}>`
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: 0;
    column-gap: 12px;
    cursor: ${({disabled}) => (disabled ? 'default' : 'pointer')};
    font-weight: inherit;
`;

export const SelectorWrapper = styled.div`
    width: 300px;
    min-height: 40px;
    margin: 0;
`;
