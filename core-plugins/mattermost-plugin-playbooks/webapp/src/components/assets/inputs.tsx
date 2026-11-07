// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

export const BaseInput = styled.input<{$invalid?: boolean}>`
    height: 40px;
    padding: 0 16px;
    border: none;
    border-radius: 4px;
    background-color: rgba(var(--center-channel-bg-rgb));
    box-shadow: ${(props) => (props.$invalid ? 'inset 0 0 0 2px var(--error-text)' : 'inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16)')};
    font-size: 14px;
    line-height: 40px;
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;

    &:focus {
        box-shadow: ${(props) => (props.$invalid ? 'inset 0 0 0 2px var(--error-text)' : 'inset 0 0 0 2px var(--button-bg)')};
    }
`;

export const BaseTextArea = styled.textarea`
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    background-color: rgba(var(--center-channel-bg-rgb));
    box-shadow: inset 0 0 0 1px rgba(var(--center-channel-color-rgb), 0.16);
    font-size: 14px;
    line-height: 20px;
    transition: border-color ease-in-out .15s, box-shadow ease-in-out .15s, -webkit-box-shadow ease-in-out .15s;

    &:focus {
        box-shadow: inset 0 0 0 2px var(--button-bg);
    }
`;

interface InputTrashIconProps {
    $show: boolean;
}

export const InputTrashIcon = styled.span<InputTrashIconProps>`
    position: absolute;
    top: 0;
    right: 5px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;
    visibility: ${(props) => (props.$show ? 'visible' : 'hidden')};

    &:hover {
        color: var(--center-channel-color);
    }
`;
