import React from 'react';
import styled from 'styled-components';

interface MenuItemProps {
    show: boolean;
    onClick: (e: React.MouseEvent) => void;

    id?: string;
    icon?: React.ReactNode;
    text?: string;
}

const MenuItem = (props: MenuItemProps) => {
    if (!props.show) {
        return null;
    }

    let textProp: React.ReactNode = props.text;
    if (props.icon) {
        textProp = (
            <>
                <span className='icon'>{props.icon}</span>
                {props.text}
            </>
        );
    }

    return (
        <MenuItemComponent
            role='menuitem'
            id={props.id}
        >
            <Button
                data-testid={props.id}
                id={props.id}
                aria-label={props.text}
                onClick={props.onClick}
            >
                {textProp && <PrimaryText>{textProp}</PrimaryText>}
            </Button>
        </MenuItemComponent>
    );
};

export default MenuItem;

const MenuItemComponent = styled.li`
    display: flex;
    width: 100%;
    align-items: center;
    font-size: 14px;
`;

const Button = styled.button`
    display: block;
    overflow: hidden;
    width: 100%;
    align-items: center;
    padding: 1px 16px;
    clear: both;
    color: inherit;
    cursor: pointer;
    font-weight: normal;
    line-height: 28px;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    border: none;
    background: transparent;

    :hover {
        background: rgba(var(--center-channel-color-rgb), 0.1);
    }
`;

const PrimaryText = styled.span`
    display: inline-flex;
    padding: 5px 0;
    line-height: 22px;
    color: rgba(var(--center-channel-color-rgb), 0.9);
    white-space: nowrap;
    cursor: pointer;
    font-weight: normal;
    text-align: left;
`;
