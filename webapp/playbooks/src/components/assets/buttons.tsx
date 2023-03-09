// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React from 'react';
import styled from 'styled-components';

import {KeyVariantCircleIcon} from '@mattermost/compass-icons/components';

export const Button = styled.button`
    display: inline-flex;
    align-items: center;
    height: 40px;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    color: rgba(var(--center-channel-color-rgb), 0.72);
    border-radius: 4px;
    border: 0px;
    font-weight: 600;
    font-size: 14px;
    padding: 0 20px;
    position: relative;
    justify-content: center;

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
        color: rgba(var(--center-channel-color-rgb), 0.32);
        background: rgba(var(--center-channel-color-rgb), 0.08);
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

    &:before {
        content: '';
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        transition: all 0.15s ease-out;
        position: absolute;
        background: rgba(var(--center-channel-color-rgb), 0.16);
        opacity: 0;
        border-radius: 4px;
    }

    &&:hover:not([disabled]) {
        color: var(--button-color);
        background: var(--button-bg);
        &:before {
            opacity: 1;
        }
    }

    &:disabled {
        color: rgba(var(--center-channel-color-rgb), 0.32);
        background: rgba(var(--center-channel-color-rgb), 0.08);
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
    align-items: center;
    justify-content: center;
    height: 40px;
    border-radius: 4px;
    border: 0px;
    font-weight: 600;
    font-size: 14px;
    padding: 0 20px;

    color: var(--button-bg);
    background: rgba(var(--button-bg-rgb), 0.08);

    &:disabled {
        color: rgba(var(--center-channel-color-rgb), 0.32);
        background: rgba(var(--center-channel-color-rgb), 0.08);
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

        &:before {
            margin: 0 7px 0 0;
        }
    }
`;

export const InvertedTertiaryButton = styled(Button)`
    transition: all 0.15s ease-out;

    && {
        color: var(--button-bg-rgb);
        background-color: rgba(var(--button-color-rgb), 0.08);
    }

    &&:hover:not([disabled]) {
        color: var(--button-bg-rgb);
        background: rgba(var(--button-bg-rgb), 0.12);
    }

    &&:active:not([disabled]) {
        color: var(--button-bg-rgb);
        background: rgba(var(--button-bg-rgb), 0.16);
    }

    &&:focus:not([disabled]) {
        color: var(--button-bg-rgb);
        background-color: rgba(var(--button-color-rgb), 0.08);
        box-shadow: inset 0px 0px 0px 2px var(--sidebar-text-active-border-rgb);
    }
`;

export const SecondaryButton = styled(TertiaryButton)`
    background: var(--button-color-rgb);
    border: 1px solid var(--button-bg);


    &:disabled {
        color: rgba(var(--center-channel-color-rgb), 0.32);
        background: transparent;
        border: 1px solid rgba(var(--center-channel-color-rgb), 0.32);
    }
`;

export const DestructiveButton = styled.button`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    font-weight: 600;
    font-size: 14px;

    padding: 0 20px;

    border-radius: 4px;
    border: 0px;

    background: var(--dnd-indicator);
    color: var(--button-color);

    :hover:enabled {
        background: linear-gradient(0deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.08)), var(--dnd-indicator);
    }

    :active, :hover:active {
        background: linear-gradient(0deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.16)), var(--dnd-indicator);
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
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 4px;
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

    display: flex;
    align-items: center;
    justify-content: center;
`;
