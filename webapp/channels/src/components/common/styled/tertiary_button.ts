// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export default `
    display: inline-flex;
    align-items: center;
    border: 0;
    background: rgba(var(--button-bg-rgb), 0.08);
    border-radius: 4px;
    color: var(--button-bg);
    font-weight: 600;
    transition: all 0.15s ease-out;

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.32);
    }

    &:hover:enabled {
        background: rgba(var(--button-bg-rgb), 0.12);
    }

    &:active:enabled {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    i {
        display: flex;
        font-size: 18px;

        &:first-child::before {
            margin: 0 7px 0 0;
        }

        &:last-child::before {
            margin: 0 0 0 7px;
        }
    }
`;
