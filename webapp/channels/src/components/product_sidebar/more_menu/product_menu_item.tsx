// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {useIntl} from 'react-intl';

import glyphMap, {CheckboxMarkedIcon, CheckboxBlankOutlineIcon} from '@mattermost/compass-icons/components';
import type {IconGlyphTypes} from '@mattermost/compass-icons/IconGlyphs';

import {toggleProductPin} from 'actions/views/product_sidebar';
import {isProductPinned} from 'selectors/views/product_sidebar';

import type {GlobalState} from 'types/store';

import './product_menu_item.scss';

type Props = {
    productId: string;
    name: string;
    icon: string;
};

/**
 * ProductMenuItem renders a product in the MoreMenu with a checkbox to toggle pinning.
 * Uses role='menuitemcheckbox' to prevent menu close on click, per WAI-ARIA patterns.
 */
const ProductMenuItem = ({productId, name, icon}: Props): JSX.Element => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const isPinned = useSelector((state: GlobalState) => isProductPinned(state, productId));

    const handleClick = useCallback(() => {
        dispatch(toggleProductPin(productId));
    }, [dispatch, productId]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
        }
    }, [handleClick]);

    // Dynamic icon lookup from compass-icons glyphMap
    const IconComponent = glyphMap[icon as IconGlyphTypes] || glyphMap['product-channels'];

    const ariaLabel = formatMessage(
        {
            id: 'product_sidebar.moreMenu.productItem.ariaLabel',
            defaultMessage: '{name}, {status}',
        },
        {
            name,
            status: isPinned
                ? formatMessage({id: 'product_sidebar.moreMenu.productItem.pinned', defaultMessage: 'pinned'})
                : formatMessage({id: 'product_sidebar.moreMenu.productItem.unpinned', defaultMessage: 'unpinned'}),
        },
    );

    return (
        <div
            className='ProductMenuItem'
            role='menuitemcheckbox'
            aria-checked={isPinned}
            aria-label={ariaLabel}
            onClick={handleClick}
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <span className='ProductMenuItem__checkbox'>
                {isPinned ? (
                    <CheckboxMarkedIcon
                        size={16}
                        color='var(--button-bg)'
                    />
                ) : (
                    <CheckboxBlankOutlineIcon size={16}/>
                )}
            </span>
            <span className='ProductMenuItem__icon'>
                <IconComponent
                    size={24}
                    color='var(--button-bg)'
                />
            </span>
            <span className='ProductMenuItem__name'>{name}</span>
        </div>
    );
};

export default ProductMenuItem;
