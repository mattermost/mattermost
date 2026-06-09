// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {Link} from 'react-router-dom';
import styled from 'styled-components';

import glyphMap, {CheckIcon, OpenInNewIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

export interface ProductMenuItemProps {
    destination: string;
    icon: IconGlyphTypes | React.ReactNode;
    text: React.ReactNode;
    active: boolean;
    onClick: () => void;

    tourTip?: React.ReactNode;
    id?: string;
}

const MenuItemTextContainer = styled.div`
    margin-left: 8px;
    flex-grow: 1;
    font-weight: 600;
    font-size: 14px;
    line-height: 20px;
`;

const OpenInNewTabButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    padding: 6px !important;
    margin-right: -6px;
    opacity: 0;
    pointer-events: none;

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.72);
    }
`;

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

    &:hover ${OpenInNewTabButton} {
        opacity: 1;
        pointer-events: auto;
    }
`;

const ProductMenuItem = ({icon, destination, text, active, onClick, tourTip, id}: ProductMenuItemProps): JSX.Element => {
    const {formatMessage} = useIntl();
    const ProductIcon = typeof icon === 'string' ? glyphMap[icon as IconGlyphTypes] : null;

    const handleOpenInNewTab = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(destination, '_blank', 'noopener,noreferrer');
        onClick();
    }, [destination, onClick]);

    return (
        <MenuItem
            to={destination}
            onClick={onClick}
            id={id}
            role='menuitem'
        >
            {ProductIcon ? (
                <ProductIcon
                    size={24}
                    color={'var(--button-bg)'}
                />
            ) : (
                icon
            )}
            <MenuItemTextContainer>
                {text}
            </MenuItemTextContainer>
            {active ? (
                <CheckIcon
                    size={18}
                    color={'var(--button-bg)'}
                />
            ) : (
                <WithTooltip
                    title={formatMessage({id: 'product_menu_item.open_in_new_tab', defaultMessage: 'Open in new tab'})}
                >
                    <OpenInNewTabButton
                        onClick={handleOpenInNewTab}
                        aria-label={formatMessage({id: 'product_menu_item.open_in_new_tab', defaultMessage: 'Open in new tab'})}
                    >
                        <OpenInNewIcon size={16}/>
                    </OpenInNewTabButton>
                </WithTooltip>
            )}
            {tourTip || null}
        </MenuItem>
    );
};

export default ProductMenuItem;
