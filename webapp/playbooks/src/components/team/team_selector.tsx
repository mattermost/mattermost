// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import styled from 'styled-components';

export interface Option {
    value: string;
    label: JSX.Element | string;
    teamId: string;
}

export const SelectedButton = styled.button`
    font-weight: 600;
    height: 40px;
    padding: 0 4px 0 12px;
    border-radius: 4px;
    color: var(--center-channel-color);
    transition: all 0.15s ease;

    border: none;
    background-color: unset;
    display: flex;
    align-items: center;
    text-align: center;

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
            cursor: pointer;
            color: var(--center-channel-color);
        }
    }


    .NoAssignee-button, .Assigned-button {
        background-color: transparent;
        border: none;
        padding: 4px;
        margin-top: 4px;
        border-radius: 100px;
        color: rgba(var(--center-channel-color-rgb), 0.64);
        cursor: pointer;
        font-weight: normal;
        font-size: 12px;
        line-height: 16px;

        -webkit-transition: all 0.15s ease;
        -moz-transition: all 0.15s ease;
        -o-transition: all 0.15s ease;
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
            &:before {
                margin: 0;
            }
        }
    }

    .first-container .Assigned-button {
        margin-top: 0;
        padding: 2px 0;
        font-size: 14px;
        line-height: 20px;
        color: var(--center-channel-color);
    }
`;
