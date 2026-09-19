// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import styled from 'styled-components';

interface MenuProps {
    ariaLabel: string;
    id?: string;
    children?: React.ReactNode;
}

const Menu = (props: MenuProps) => {
    const myRef = useRef(null);

    const handleMenuClick = (e: React.MouseEvent) => {
        if (e.target === myRef.current) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    return (
        <MenuComponent
            aria-label={props.ariaLabel}
            id={props.id}
            role='menu'
        >
            <MenuContent
                ref={myRef}
                onClick={handleMenuClick}
            >
                {props.children}
            </MenuContent>
        </MenuComponent>
    );
};

export default Menu;

const MenuComponent = styled.div`
    z-index: 10000;
`;

const MenuContent = styled.ul`
    position: absolute;
    z-index: 1000;
    left: 0;
    display: block;
    min-width: 210px;
    max-width: 232px;
    max-height: 80vh;
    padding: 8px 0;
    border: 1px solid rgba(0 0 0 / 0.15);
    border-color: rgba(var(--center-channel-color-rgb), 0.2);
    border-radius: 4px;
    margin: 2px 0 0;
    margin-top: 0;
    margin-left: 0;
    background: var(--center-channel-bg);
    box-shadow: 0 6px 12px rgba(0 0 0 / 0.18);
    color: var(--center-channel-color-rgb);
    cursor: default;
    float: left;
    font-size: 14px;
    line-height: 19px;
    list-style: none;
    text-align: left;
    transform: translate(0, 0);

    ul {
        padding: 8px 0;
        margin: 0;
    }

    li {
        list-style: none;

        a {
            color: inherit;
        }
    }
`;
