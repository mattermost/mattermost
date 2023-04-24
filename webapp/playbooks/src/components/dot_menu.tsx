// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useState} from 'react';
import styled, {css} from 'styled-components';

import {useUpdateEffect} from 'react-use';

import Tooltip from 'src/components/widgets/tooltip';
import {useUniqueId} from 'src/utils';

import Dropdown from './dropdown';
import {PrimaryButton} from './assets/buttons';

export const DotMenuButton = styled.div<{isActive: boolean}>`
    display: inline-flex;
    padding: 0;
    border: none;
    border-radius: 4px;
    width: 3.2rem;
    height: 3.2rem;
    fill: rgba(var(--center-channel-color-rgb), 0.56);
    cursor: pointer;

    color: ${(props) => (props.isActive ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
    background-color: ${(props) => (props.isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'transparent')};

    &:hover {
        color: ${(props) => (props.isActive ? 'var(--button-bg)' : 'rgba(var(--center-channel-color-rgb), 0.56)')};
        background-color: ${(props) => (props.isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }
`;

export const DropdownMenu = styled.div`
    display: flex;
    flex-direction: column;

    width: max-content;
    min-width: 16rem;
    text-align: left;
    list-style: none;

    padding: 10px 0;
    font-family: Open Sans;
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    line-height: 20px;
    color: var(--center-channel-color);

    background: var(--center-channel-bg);
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.16);
    box-shadow: 0px 8px 24px rgba(0, 0, 0, 0.12);
    border-radius: 4px;

    z-index: 12;
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

        // @ts-ignore
        <MenuButton
            title={title}
            isActive={(isActive ?? false) || isOpen}
            onClick={(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                toggleOpen();
            }}
            onKeyDown={(e: KeyboardEvent) => {
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
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    color: var(--center-channel-color);
    padding: 10px 20px;
    text-decoration: unset;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: var(--center-channel-color);
    }
    &&:focus {
        text-decoration: none;
        color: inherit;
  }
}
`;

export const DisabledDropdownMenuItemStyled = styled.div`
 && {
    cursor: default;
    font-family: 'Open Sans';
    font-style: normal;
    font-weight: normal;
    font-size: 14px;
    color: var(--center-channel-color-40);
    padding: 8px 20px;
    text-decoration: unset;
}
`;

export const iconSplitStyling = css`
    display: flex;
    align-items: center;
    gap: 8px;
`;

export const DropdownMenuItem = (props: { children: React.ReactNode, onClick: () => void, className?: string, disabled?: boolean, disabledAltText?: string }) => {
    const tooltipId = useUniqueId();

    if (props.disabled) {
        return (
            <Tooltip
                id={tooltipId}
                content={props.disabledAltText}
            >
                <DisabledDropdownMenuItemStyled
                    className={props.className}
                >
                    {props.children}
                </DisabledDropdownMenuItemStyled>
            </Tooltip>
        );
    }

    return (
        <DropdownMenuItemStyled
            href='#'
            onClick={props.onClick}
            className={props.className}
            role={'button'}

            // Prevent trigger icon (parent) from propagating title prop to options
            // Menu items use to be full text (not just icons) so don't need title
            title=''
        >
            {props.children}
        </DropdownMenuItemStyled>
    );
};

// Alternate dot menu button. Use `dotMenuButton={TitleButton}` for this style.
export const TitleButton = styled.div<{isActive: boolean}>`
    padding: 2px 2px 2px 6px;
    display: inline-flex;
    border-radius: 4px;
    color: ${({isActive}) => (isActive ? 'var(--button-bg)' : 'var(--center-channel-color)')};
    background: ${({isActive}) => (isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'auto')};

    min-width: 0;

    &:hover {
        background: ${({isActive}) => (isActive ? 'rgba(var(--button-bg-rgb), 0.08)' : 'rgba(var(--center-channel-color-rgb), 0.08)')};
    }
`;

export default DotMenu;
