// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

export const AutomationHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
`;

export const AutomationTitle = styled.div`
    display: flex;
    flex-direction: row;
    width: 350px;
    align-items: center;
    column-gap: 12px;
`;

export const AutomationLabel = styled.label<{disabled?: boolean}>`
    display: flex;
    flex-direction: row;
    align-items: center;
    column-gap: 12px;
    font-weight: inherit;
    margin-bottom: 0;
    cursor: ${({disabled}) => (disabled ? 'default' : 'pointer')};
`;

export const SelectorWrapper = styled.div`
    margin: 0;
    width: 300px;
    min-height: 40px;
`;
