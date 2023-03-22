import React from 'react';
import styled from 'styled-components';

interface MenuGroupProps {
    noDivider?: boolean;
    divider?: React.ReactNode;
    children?: React.ReactNode;
}

const MenuGroup = (props: MenuGroupProps) => {
    const handleDividerClick = (e: React.MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
    };

    const divider = props.divider || <Divider onClick={handleDividerClick}/>;

    return (
        <React.Fragment>
            {!props.noDivider && divider}
            {props.children}
        </React.Fragment>
    );
};

export default MenuGroup;

const Divider = styled.li`
    height: 1px;
    margin: 8px 0;
    background: rgba(var(--center-channel-color-rgb), 0.08);
    cursor: default;
`;
