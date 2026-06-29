// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import glyphMap from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import type {ProductSwitcherMenuItemRegistration} from 'types/store/plugins';

import {ProductMenuItemText, productMenuRowStyle} from '../menu_item_styles';

// Button variant of the product-switcher row. ProductMenuItem is a Link (it needs a destination
// URL); plugin items are action-based, so they render a button instead while sharing the same row
// style. The button resets keep it visually identical to the link rows.
const SwitcherActionButton = styled.button`
    ${productMenuRowStyle}

    appearance: none;
    background: transparent;
    border: none;
    font-family: inherit;
    text-align: left;
`;

type Props = {
    item: ProductSwitcherMenuItemRegistration;

    // Closes the product-switcher menu. Always fires after the item's action, even if it throws.
    onClose: () => void;
};

const ProductSwitcherMenuItem = ({item, onClose}: Props): JSX.Element => {
    const Icon = typeof item.icon === 'string' ? glyphMap[item.icon as IconGlyphTypes] : null;

    const handleClick = () => {
        try {
            item.action();
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(`ProductSwitcherMenuItem ${item.pluginId}:${item.id} action threw`, e);
        }
        onClose();
    };

    return (
        <li
            id={`product-switcher-menu-item-${item.id}`}
            role='menuitem'
        >
            <SwitcherActionButton
                type='button'
                onClick={handleClick}
            >
                {Icon ? (
                    <Icon
                        size={24}
                        color={'var(--button-bg)'}
                    />
                ) : item.icon}
                <ProductMenuItemText>{item.text}</ProductMenuItemText>
            </SwitcherActionButton>
        </li>
    );
};

export default ProductSwitcherMenuItem;
