// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useState} from 'react';
import styled, {css} from 'styled-components';

import {useUpdateEffect} from 'react-use';

import Tooltip from 'src/components/widgets/tooltip';
import {useUniqueId} from 'src/utils';

import Dropdown from './dropdown';
import {PrimaryButton} from './assets/buttons';

export const DotMenuButton = styled.button<{$isActive?: boolean}>`
    display: inline-flex;
    width: 3.2rem;
    height: 3.2rem;
    padding: 0;
    border: none;
    border-radius: 4px;
    background-color: ${(props) => (props.$isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent')};
    color: ${(props) => (props.$isActive ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
    cursor: pointer;
    fill: rgba(var(--center-channel-color-rgb), 0.56);

    &:hover {
        background-color: ${(props) => (props.$isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
        color: ${(props) => (props.$isActive ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
    }
`;

export const DropdownMenu = styled.div`
    z-index: 12;
    display: flex;
    width: max-content;
    min-width: 16rem;
    flex-direction: column;
    padding: 10px 0;
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    border-radius: 4px;
    background: var(--center-channel-bg);
    box-shadow: 0 8px 24px rgba(0 0 0 / 0.12);
    color: var(--center-channel-color);
    font-family: "Open Sans";
    font-size: 14px;
    font-style: normal;
    font-weight: normal;
    line-height: 20px;
    list-style: none;
    text-align: left;
`;

type DotMenuProps = {
    children: React.ReactNode;
    icon: JSX.Element;
    dotMenuButton?: typeof DotMenuButton | typeof PrimaryButton;
    dropdownMenu?: typeof DropdownMenu;
    title?: string;
    disabled?: boolean;
    className?: string;
    isActive?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
    closeOnClick?: boolean;
};

type DropdownProps = Omit<ComponentProps<typeof Dropdown>, 'target' | 'children'>;

const DotMenu = ({
    children,
    icon,
    title,
    className,
    disabled,
    isActive,
    closeOnClick = true,
    dotMenuButton: MenuButton = DotMenuButton,
    dropdownMenu: Menu = DropdownMenu,
    onOpenChange,
    ...props
}: DotMenuProps & DropdownProps) => {
    const [isOpen, setOpen] = useState(false);
    const toggleOpen = () => {
        setOpen(!isOpen);
    };
    useUpdateEffect(() => {
        onOpenChange?.(isOpen);
    }, [isOpen]);

    const button = (
        <MenuButton
            title={title}
            $isActive={(isActive ?? false) || isOpen}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleOpen();
            }}
            onKeyDown={(e) => {
                // Handle Enter and Space as clicking on the button
                if (e.key === 'Space' || e.key === 'Enter') {
                    e.stopPropagation();
                    toggleOpen();
                }
            }}
            tabIndex={0}
            className={className}
            role={'button'}
            disabled={disabled ?? false}
            data-testid={'menuButton' + (title ?? '')}
        >
            {icon}
        </MenuButton>
    );

    return (
        <Dropdown
            {...props}
            isOpen={isOpen}
            onOpenChange={setOpen}
            target={button}
        >
            <Menu
                data-testid='dropdownmenu'
                onClick={(e) => {
                    e.stopPropagation();
                    if (closeOnClick) {
                        setOpen(false);
                    }
                }}
            >
                {children}
            </Menu>
        </Dropdown>
    );
};

export const DropdownMenuItemStyled = styled.a`
    && {
        padding: 10px 20px;
        color: var(--center-channel-color);
        font-family: 'Open Sans';
        font-size: 14px;
        font-style: normal;
        font-weight: normal;
        text-decoration: unset;

        &:hover {
            background: rgba(var(--center-channel-color-rgb), 0.08);
            color: var(--center-channel-color);
        }

        &:focus {
            color: inherit;
            text-decoration: none;
        }
    }
`;

export const DisabledDropdownMenuItemStyled = styled.div`
    && {
        padding: 8px 20px;
        color: var(--center-channel-color-40);
        cursor: default;
        font-family: 'Open Sans';
        font-size: 14px;
        font-style: normal;
        font-weight: normal;
        text-decoration: unset;
    }
`;

export const iconSplitStyling = css`
    display: flex;
    align-items: center;
    gap: 8px;
`;

export const DropdownMenuItem = (props: { children: React.ReactNode, onClick: () => void, className?: string, disabled?: boolean, disabledAltText?: string, 'data-testid'?: string }) => {
    const tooltipId = useUniqueId();
    const onClick = (e: React.MouseEvent) => {
        e.preventDefault();
        props.onClick();
    };

    if (props.disabled) {
        return (
            <Tooltip
                id={tooltipId}
                content={props.disabledAltText}
            >
                <DisabledDropdownMenuItemStyled
                    className={props.className}
                    data-testid={props['data-testid']}
                >
                    {props.children}
                </DisabledDropdownMenuItemStyled>
            </Tooltip>
        );
    }

    return (
        <DropdownMenuItemStyled
            href='#'
            onClick={onClick}
            className={props.className}
            role={'button'}
            data-testid={props['data-testid']}

            // Prevent trigger icon (parent) from propagating title prop to options
            // Menu items use to be full text (not just icons) so don't need title
            title=''
        >
            {props.children}
        </DropdownMenuItemStyled>
    );
};

// Alternate dot menu button. Use `dotMenuButton={TitleButton}` for this style.
export const TitleButton = styled.button<{$isActive?: boolean}>`
    display: inline-flex;
    min-width: 0;
    max-width: 100%;
    padding: 2px 2px 2px 6px;
    border-radius: 4px;
    background: ${({$isActive}) => ($isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'none')};
    color: ${({$isActive}) => ($isActive ? 'var(--button-bg)' : 'var(--center-channel-color)')};
    border: none;

    &:hover {
        background: ${({$isActive}) => ($isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }
`;

export default DotMenu;
