// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import glyphMap, {ProductChannelsIcon} from '@mattermost/compass-icons/components';

import {useCurrentProduct} from 'utils/products';

const ProductBranding = (): JSX.Element => {
    const currentProduct = useCurrentProduct();

    const ProductIcon = currentProduct?.switcherIcon ? glyphMap[currentProduct.switcherIcon] : ProductChannelsIcon;
    const productName = currentProduct ? currentProduct.switcherText : 'Channels';

    return (
        <span className='globalHeader-leftControls-productBranding-licencedEdition'>
            <ProductIcon size={24}/>
            <h1 className='sr-only'>
                {productName}
            </h1>
            <span className='globalHeader-leftControls-productBranding-licencedEdition-heading'>
                {productName}
            </span>
        </span >
    );
};

export default ProductBranding;
