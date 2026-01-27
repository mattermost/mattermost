// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getPinnedProductIds} from 'selectors/views/product_sidebar';

import {useProducts, useCurrentProductId, isChannels} from 'utils/products';

import {MoreMenu} from '../more_menu';

import ProductIcon from './product_icon';

import './product_section.scss';

/**
 * ProductSection renders the product navigation list in the sidebar.
 * Only shows pinned products (controlled via MoreMenu).
 * Channels appears first if pinned, followed by other pinned products.
 * MoreMenu button appears at the bottom for managing pins and accessing system items.
 */
const ProductSection = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const products = useProducts();
    const currentProductId = useCurrentProductId();
    const pinnedProductIds = useSelector(getPinnedProductIds);

    const channelsName = formatMessage({
        id: 'product_sidebar.channels',
        defaultMessage: 'Channels',
    });

    // Check if we're currently on Channels (productId is null)
    const isOnChannels = isChannels(currentProductId);

    // Show Channels only if 'channels' is in pinned list (it's in by default)
    const showChannels = pinnedProductIds.includes('channels');

    // Filter plugin products to only pinned ones
    const pinnedProducts = products?.filter((p) => pinnedProductIds.includes(p.id)) || [];

    return (
        <div className='ProductSection'>
            {/* Channels icon - shown if pinned */}
            {showChannels && (
                <ProductIcon
                    icon='product-channels'
                    destination='/'
                    name={channelsName}
                    active={isOnChannels}
                />
            )}

            {/* Pinned plugin products */}
            {pinnedProducts.map((product) => (
                <ProductIcon
                    key={product.id}
                    icon={product.switcherIcon}
                    destination={product.switcherLinkURL}
                    name={product.switcherText}
                    active={product.id === currentProductId}
                />
            ))}

            {/* More menu button and dropdown */}
            <MoreMenu/>
        </div>
    );
};

export default ProductSection;
