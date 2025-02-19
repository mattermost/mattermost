// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import glyphMap, {ProductChannelsIcon} from '@mattermost/compass-icons/components';

import {useCurrentProduct} from 'utils/products';

export default function ProductBranding() {
    const currentProduct = useCurrentProduct();

    const Icon = currentProduct?.switcherIcon ? glyphMap[currentProduct.switcherIcon] : ProductChannelsIcon;

    return (
        <>
            <Icon size={24}/>
            <span className='product_heading'>
                {currentProduct ? currentProduct.switcherText : 'Channels'}
            </span>
        </>
    );
}
