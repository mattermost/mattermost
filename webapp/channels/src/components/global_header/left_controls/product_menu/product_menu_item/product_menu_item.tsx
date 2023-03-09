// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Link} from 'react-router-dom';

import styled from 'styled-components';

import Icon, {TIconGlyph} from '@mattermost/compass-components/foundations/icon';

export interface ProductMenuItemProps {
    destination: string;
    icon: TIconGlyph;
    text: React.ReactNode;
    active: boolean;
    onClick: () => void;

    tourTip?: React.ReactNode;
    id?: string;
}

const MenuItem = styled(Link)`
    && {
        text-decoration: none;
        color: inherit;
    }

    height: 40px;
    width: 270px;
    padding-left: 16px;
    padding-right: 20px;
    display: flex;
    align-items: center;
    cursor: pointer;
    position: relative;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        text-decoration: none;
        color: inherit;
    }

    button {
        padding: 0 6px;
    }
`;

const StyledIcon = styled(Icon)`
    color: var(--button-bg);
`;

const MenuItemTextContainer = styled.div`
    margin-left: 8px;
    flex-grow: 1;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
`;

const ProductMenuItem = ({icon, destination, text, active, onClick, tourTip, id}: ProductMenuItemProps): JSX.Element => (
    <MenuItem
        to={destination}
        onClick={onClick}
        id={id}
    >
        <StyledIcon
            size={20}
            glyph={icon || 'none'}
        />
        <MenuItemTextContainer>
            {text}
        </MenuItemTextContainer>
        {active && (
            <StyledIcon
                size={16}
                glyph='check'
            />
        )}
        {tourTip || null}
    </MenuItem>
);

export default ProductMenuItem;
