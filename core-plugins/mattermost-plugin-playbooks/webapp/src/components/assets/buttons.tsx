// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {KeyVariantCircleIcon} from '@mattermost/compass-icons/components';

export const Button = styled.button`
    position: relative;
    display: inline-flex;
    height: 40px;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    border: 0;
    border-radius: 4px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.72);
    font-size: 14px;
    font-weight: 600;
    transition: all 0.15s ease-out;

    &:hover{
        background: rgba(var(--center-channel-color-rgb), 0.12);
    }

    &&, &&:focus {
        text-decoration: none;
    }

    &&:hover:not([disabled]) {
        text-decoration: none;
    }

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.32);
    }

    i {
        display: flex;
        font-size: 18px;
    }
`;

export const PrimaryButton = styled(Button)`
    &&, &&:focus {
        background: var(--button-bg);
        color: var(--button-color);
        white-space: nowrap;
    }

    &:active:not([disabled]) {
        background: rgba(var(--button-bg-rgb), 0.8);
    }

    &::before {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 4px;
        background: rgba(var(--center-channel-color-rgb), 0.16);
        content: '';
        opacity: 0;
        transition: all 0.15s ease-out;
    }

    &&:hover:not([disabled]) {
        background: var(--button-bg);
        color: var(--button-color);

        &::before {
            opacity: 1;
        }
    }

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.32);
    }
`;

export const PrimaryButtonDestructive = styled(Button)`
    &&, &&:focus {
        background: var(--error-text);
        color: var(--button-color);
        white-space: nowrap;
    }

    &:active:not([disabled]) {
        background: rgba(var(--error-text-color-rgb), 0.8);
    }

    &::before {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border-radius: 4px;
        background: rgba(var(--center-channel-color-rgb), 0.16);
        content: '';
        opacity: 0;
        transition: all 0.15s ease-out;
    }

    &&:hover:not([disabled]) {
        background: var(--error-text);
        color: var(--button-color);

        &::before {
            opacity: 1;
        }
    }

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.32);
    }
`;

export const SubtlePrimaryButton = styled(Button)`
    background: rgba(var(--button-bg-rgb), 0.08);
    color: var(--button-bg);

    &:hover,
    &:active {
        background: rgba(var(--button-bg-rgb), 0.12);
    }
`;

export const TertiaryButton = styled.button`
    display: inline-flex;
    height: 40px;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    border: 0;
    border-radius: 4px;
    background: rgba(var(--button-bg-rgb), 0.08);
    color: var(--button-bg);
    font-size: 14px;
    font-weight: 600;

    &:disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.32);
    }

    &:hover:enabled {
        background: rgba(var(--button-bg-rgb), 0.12);
    }

    &:active:enabled  {
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    i {
        display: flex;
        font-size: 18px;

        &::before {
            margin: 0 7px 0 0;
        }
    }
`;

export const InvertedTertiaryButton = styled(Button)`
    transition: all 0.15s ease-out;

    && {
        background-color: rgba(var(--button-color-rgb), 0.08);
        color: var(--button-bg-rgb);
    }

    &&:hover:not([disabled]) {
        background: rgba(var(--button-bg-rgb), 0.12);
        color: var(--button-bg-rgb);
    }

    &&:active:not([disabled]) {
        background: rgba(var(--button-bg-rgb), 0.16);
        color: var(--button-bg-rgb);
    }

    &&:focus:not([disabled]) {
        background-color: rgba(var(--button-color-rgb), 0.08);
        box-shadow: inset 0 0 0 2px var(--sidebar-text-active-border-rgb);
        color: var(--button-bg-rgb);
    }
`;

export const SecondaryButton = styled(TertiaryButton)`
    border: 1px solid var(--button-bg);
    background: var(--button-color-rgb);


    &:disabled {
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.32);
        background: transparent;
        color: rgba(var(--center-channel-color-rgb), 0.32);
    }
`;

export const DestructiveButton = styled.button`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    border: 0;
    border-radius: 4px;
    background: var(--dnd-indicator);
    color: var(--button-color);
    font-size: 14px;
    font-weight: 600;

    &:hover:enabled {
        background: linear-gradient(0deg, rgba(0 0 0 / 0.08), rgba(0 0 0 / 0.08)), var(--dnd-indicator);
    }

    &:active, &:hover:active {
        background: linear-gradient(0deg, rgba(0 0 0 / 0.16), rgba(0 0 0 / 0.16)), var(--dnd-indicator);
    }

    :disabled {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }
`;

export type UpgradeButtonProps = React.ComponentProps<typeof PrimaryButton>;

export const UpgradeTertiaryButton = (props: UpgradeButtonProps & {className?: string}) => {
    const {children, ...rest} = props;
    return (
        <TertiaryButton {...rest}>
            {children}
            <PositionedKeyVariantCircleIcon/>
        </TertiaryButton>
    );
};

const PositionedKeyVariantCircleIcon = styled(KeyVariantCircleIcon)`
    position: absolute;
    top: -4px;
    right: -6px;
    color: var(--online-indicator);
`;

export const ButtonIcon = styled.button`

    display: flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    fill: rgba(var(--center-channel-color-rgb), 0.56);
    font-size: 1.6rem;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
        fill: rgba(var(--center-channel-color-rgb), 0.72);
    }

    &:active,
    &--active,
    &--active:hover {
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);
        fill: var(--button-bg);
    }
`;
