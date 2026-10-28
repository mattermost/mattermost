// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

export interface Option {
    value: string;
    label: JSX.Element | string;
    teamId: string;
}

export const SelectedButton = styled.button`
    display: flex;
    height: 40px;
    align-items: center;
    padding: 0 4px 0 12px;
    border: none;
    border-radius: 4px;
    background-color: unset;
    color: var(--center-channel-color);
    font-weight: 600;
    text-align: center;
    transition: all 0.15s ease;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }

    .PlaybookRunProfile {
        &:active {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
        }

        &.active {
            color: var(--center-channel-color);
            cursor: pointer;
        }
    }


    .NoAssignee-button, .Assigned-button {
        padding: 4px;
        border: none;
        border-radius: 100px;
        margin-top: 4px;
        background-color: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: pointer;
        font-size: 12px;
        font-weight: normal;
        line-height: 16px;
        transition: all 0.15s ease;

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: rgba(var(--center-channel-color-rgb), 0.72);
        }

        &:active {
            background: rgba(var(--button-bg-rgb), 0.08);
            color: var(--button-bg);
        }

        &.active {
            cursor: pointer;
        }

        .icon-chevron-down {
            &::before {
                margin: 0;
            }
        }
    }

    .first-container .Assigned-button {
        padding: 2px 0;
        margin-top: 0;
        color: var(--center-channel-color);
        font-size: 14px;
        line-height: 20px;
    }
`;
