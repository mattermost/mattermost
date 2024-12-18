// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import MenuList from '@mui/material/MenuList';
import React from 'react';
import styled from 'styled-components';

import {CheckIcon, AlertOutlineIcon, AlertCircleOutlineIcon, MessageTextOutlineIcon, CheckCircleOutlineIcon, BellRingOutlineIcon} from '@mattermost/compass-icons/components';

import {MenuItem} from 'components/menu/menu_item';
import Toggle from 'components/toggle';

type ToggleProps = {
    ariaLabel?: string;
    description: React.ReactNode;
    disabled: boolean;
    icon: React.ReactNode;
    onClick: () => void;
    text: React.ReactNode;
    toggled: boolean;
}

const Wrapper = styled(MenuItem)`
    cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};

    &:hover {
        background-color: rgba(var(--center-channel-color-rgb), 0.1);
    }>
`;

const Description = styled.div`
    font-size: 12px;
    color: rgba(var(--center-channel-color-rgb), 0.75);
    max-width: 200px;
    text-wrap: wrap;
`;

const StyledCheckIcon = styled(CheckIcon)`
    display: flex;
    margin-left: 24px;
    fill: var(--button-bg);
`;

const Menu = styled(MenuList)`
    &&& {
        display: block;
        position: relative;
        box-shadow: none;
        border-radius: 0;
        border: 0;
        padding: 0 0 8px;
        margin: 0;
        color: var(--center-channel-color-rgb);
        list-style: none;
        max-width:320px;
    }
`;

const Header = styled.h4`
    align-items: center;
    display: flex;
    gap: 8px;
    font-family: 'Open Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 20px;
    padding: 14px 16px 6px;
    text-align: left;
`;

const Footer = styled.div`
    align-items: center;
    display: flex;
    font-family: Open Sans;
    justify-content: flex-end;
    padding: 16px;
    gap: 8px;
`;

const UrgentIcon = styled(AlertOutlineIcon)`
    fill: rgb(var(--semantic-color-danger));
`;

const ImportantIcon = styled(AlertCircleOutlineIcon)`
    fill: rgb(var(--semantic-color-info));
`;

const StandardIcon = styled(MessageTextOutlineIcon)`
    fill: rgba(var(--center-channel-color-rgb), 0.75);
`;

const AcknowledgementIcon = styled(CheckCircleOutlineIcon)`
    fill: rgba(var(--center-channel-color-rgb), 0.75);
`;

const PersistentNotificationsIcon = styled(BellRingOutlineIcon)`
    fill: rgba(var(--center-channel-color-rgb), 0.75);
`;

function ToggleItem({
    ariaLabel,
    description,
    disabled,
    icon,
    onClick,
    text,
    toggled,
}: ToggleProps) {
    return (
        <Wrapper
            onClick={disabled ? undefined : onClick}
            disabled={disabled}
            leadingElement={icon}
            tabIndex={-1}
            role='menuitemcheckbox'
            aria-checked={toggled}
            aria-label={ariaLabel}
            trailingElements={<>
                <Toggle
                    ariaLabel={ariaLabel}
                    size='btn-sm'
                    disabled={disabled}
                    onToggle={onClick}
                    toggled={toggled}
                    toggleClassName='btn-toggle-primary'
                    tabIndex={-1}
                />
            </>}
            labels={<>
                <div>
                    {text}
                </div>
                <Description>
                    {description}
                </Description>
            </>}
        />
    );
}

export {MenuItem, ToggleItem, StyledCheckIcon, Header, UrgentIcon, ImportantIcon, StandardIcon, AcknowledgementIcon, PersistentNotificationsIcon, Footer};

export default Menu;
