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
    transform: translate(0px, 0px);
    margin-left: 0px;
    margin-top: 0px;
    min-width: 210px;
    max-width: 232px;

    border-color: rgba(var(--center-channel-color-rgb), 0.2);
    color: var(--center-channel-color-rgb);
    background: var(--center-channel-bg);

    display: block;
    max-height: 80vh;
    padding: 8px 0;
    border-radius: 4px;

    left: 0;
    z-index: 1000;
    float: left;
    margin: 2px 0 0;
    font-size: 14px;
    line-height: 19px;
    text-align: left;
    list-style: none;
    border: 1px solid rgba(0, 0, 0, 0.15);
    box-shadow: 0 6px 12px rgb(0 0 0 / 18%);
    cursor: default;

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
