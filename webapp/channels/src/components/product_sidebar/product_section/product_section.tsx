// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {useProducts, useCurrentProductId, isChannels} from 'utils/products';

import ProductIcon from './product_icon';

import './product_section.scss';

/**
 * ProductSection renders the product navigation list in the sidebar.
 * Shows Channels first (hardcoded), then all plugin-registered products.
 */
const ProductSection = (): JSX.Element => {
    const {formatMessage} = useIntl();
    const products = useProducts();
    const currentProductId = useCurrentProductId();

    const channelsName = formatMessage({
        id: 'product_sidebar.channels',
        defaultMessage: 'Channels',
    });

    // Check if we're currently on Channels (productId is null)
    const isOnChannels = isChannels(currentProductId);

    return (
        <div className='ProductSection'>
            {/* Channels icon - always first */}
            <ProductIcon
                icon='product-channels'
                destination='/'
                name={channelsName}
                active={isOnChannels}
            />

            {/* Plugin-registered products */}
            {products?.map((product) => (
                <ProductIcon
                    key={product.id}
                    icon={product.switcherIcon}
                    destination={product.switcherLinkURL}
                    name={product.switcherText}
                    active={product.id === currentProductId}
                />
            ))}
        </div>
    );
};

export default ProductSection;
